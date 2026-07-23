import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";

import { describeWithDatabase, testDatabaseUrl } from "@/lib/test-db-helper";
import {
  capacityHold,
  event,
  registration,
  registrationAnswer,
  registrationVerification,
} from "../../../lib/db/schema";
import { createRegistrationApplicationService } from "./registration-application";

describeWithDatabase("Registration application service", () => {
  const client = new Pool({ connectionString: testDatabaseUrl! });
  const database = drizzle({ client });
  const eventIds: string[] = [];
  const deliveredTokens: string[] = [];
  const service = createRegistrationApplicationService({
    database,
    now: () => new Date("2030-01-01T12:00:00.000Z"),
    createToken: () => `token-${deliveredTokens.length + 1}-${crypto.randomUUID()}`,
    sendVerificationEmail: async ({ token }) => {
      deliveredTokens.push(token);
    },
  });

  async function createPublishedEvent(capacity: number) {
    const [created] = await database
      .insert(event)
      .values({
        name: "Registration integration test",
        description: "Exercises PostgreSQL capacity invariants.",
        slug: `registration-test-${crypto.randomUUID()}`,
        status: "published",
        eventTimeZone: "UTC",
        startsAt: new Date("2030-01-02T12:00:00.000Z"),
        endsAt: new Date("2030-01-02T14:00:00.000Z"),
        venueName: "Test Venue",
        venueAddress: "Test address",
        capacity,
        registrationOpensAt: new Date("2029-12-01T00:00:00.000Z"),
        registrationClosesAt: new Date("2030-01-02T12:00:00.000Z"),
        checkInOpensAt: new Date("2030-01-02T11:00:00.000Z"),
        checkInClosesAt: new Date("2030-01-02T14:00:00.000Z"),
        publishedAt: new Date("2029-12-01T00:00:00.000Z"),
      })
      .returning({ id: event.id, slug: event.slug });
    eventIds.push(created!.id);
    return created!;
  }

  beforeAll(async () => {
    await database.execute("select 1");
  });

  afterAll(async () => {
    if (eventIds.length === 0) return;
    const registrations = await database
      .select({ id: registration.id })
      .from(registration)
      .where(inArray(registration.eventId, eventIds));
    const registrationIds = registrations.map(({ id }) => id);
    if (registrationIds.length > 0) {
      await database
        .delete(registrationAnswer)
        .where(inArray(registrationAnswer.registrationId, registrationIds));
      await database
        .delete(registrationVerification)
        .where(inArray(registrationVerification.registrationId, registrationIds));
      await database
        .delete(capacityHold)
        .where(inArray(capacityHold.registrationId, registrationIds));
      await database.delete(registration).where(inArray(registration.id, registrationIds));
    }
    await database.delete(event).where(inArray(event.id, eventIds));
    await client.end();
  });

  it("does not let concurrent claims overbook the final place", async () => {
    const publishedEvent = await createPublishedEvent(1);

    const outcomes = await Promise.all([
      service.submit(publishedEvent.slug, {
        name: "First Attendee",
        email: "first@example.com",
        answers: {},
      }),
      service.submit(publishedEvent.slug, {
        name: "Second Attendee",
        email: "second@example.com",
        answers: {},
      }),
    ]);

    expect(outcomes.map(({ outcome }) => outcome).sort()).toEqual([
      "capacity_hold",
      "waitlist_verification",
    ]);
  });

  it("does not create two active Registrations for one normalized email", async () => {
    const publishedEvent = await createPublishedEvent(5);

    const outcomes = await Promise.all([
      service.submit(publishedEvent.slug, {
        name: "Grace Hopper",
        email: "Grace@Example.com",
        answers: {},
      }),
      service.submit(publishedEvent.slug, {
        name: "Grace Hopper",
        email: " grace@example.COM ",
        answers: {},
      }),
    ]);

    const created = outcomes.find(({ outcome }) => outcome === "capacity_hold");
    const existing = outcomes.find(({ outcome }) => outcome === "existing_registration");
    expect(created?.outcome).toBe("capacity_hold");
    expect(existing?.outcome).toBe("existing_registration");
    if (created?.outcome !== "capacity_hold") throw new Error("Missing Capacity Hold.");
    if (existing?.outcome !== "existing_registration") {
      throw new Error("Missing existing Registration outcome.");
    }
    expect(existing.registrationId).toBe(created.registrationId);

    const persisted = await service.findActiveRegistration(
      publishedEvent.id,
      "grace@example.com",
    );
    expect(persisted?.registrationId).toBe(created.registrationId);
  });
});
