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
      }, new Headers()),
      service.submit(publishedEvent.slug, {
        name: "Second Attendee",
        email: "second@example.com",
        answers: {},
      }, new Headers()),
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
      }, new Headers()),
      service.submit(publishedEvent.slug, {
        name: "Grace Hopper",
        email: " grace@example.COM ",
        answers: {},
      }, new Headers()),
    ]);

    const created = outcomes.find(({ outcome }) => outcome === "capacity_hold");
    expect(created?.outcome).toBe("capacity_hold");
    if (created?.outcome !== "capacity_hold") throw new Error("Missing Capacity Hold.");
    expect(
      outcomes.every(
        (outcome) =>
          outcome.outcome === "capacity_hold" ||
          outcome.outcome === "existing_registration",
      ),
    ).toBe(true);
    expect(
      new Set(
        outcomes.flatMap((outcome) =>
          "registrationId" in outcome ? [outcome.registrationId] : [],
        ),
      ).size,
    ).toBe(1);

    const persisted = await service.findActiveRegistration(
      publishedEvent.id,
      "grace@example.com",
    );
    expect(persisted?.registrationId).toBe(created.registrationId);
  });

  it("lets an Expired Registration register again after the hold lapses", async () => {
    let current = new Date("2030-01-01T12:00:00.000Z");
    const timedService = createRegistrationApplicationService({
      database,
      now: () => current,
      createToken: () => `lapse-${crypto.randomUUID()}`,
      sendVerificationEmail: async () => undefined,
    });
    const publishedEvent = await createPublishedEvent(1);
    const values = {
      name: "Alice Example",
      email: `alice-${crypto.randomUUID()}@example.com`,
      answers: {},
    };

    const first = await timedService.submit(
      publishedEvent.slug,
      values,
      new Headers(),
    );
    expect(first.outcome).toBe("capacity_hold");

    current = new Date("2030-01-01T12:16:00.000Z");
    const second = await timedService.submit(
      publishedEvent.slug,
      values,
      new Headers(),
    );
    expect(second.outcome).toBe("capacity_hold");
    if (first.outcome !== "capacity_hold" || second.outcome !== "capacity_hold") {
      throw new Error("Expected two Capacity Holds.");
    }
    expect(second.registrationId).not.toBe(first.registrationId);
  });

  it("resends verification for an unconfirmed Registration without extending the Hold", async () => {
    const tokens: string[] = [];
    let failNext = true;
    const retryService = createRegistrationApplicationService({
      database,
      now: () => new Date("2030-01-01T12:00:00.000Z"),
      createToken: () => {
        const token = `retry-${tokens.length}-${crypto.randomUUID()}`;
        tokens.push(token);
        return token;
      },
      sendVerificationEmail: async () => {
        if (failNext) {
          failNext = false;
          throw new Error("delivery failed");
        }
      },
    });
    const publishedEvent = await createPublishedEvent(1);
    const values = {
      name: "Retry Attendee",
      email: `retry-${crypto.randomUUID()}@example.com`,
      answers: {},
    };
    const first = await retryService.submit(
      publishedEvent.slug,
      values,
      new Headers(),
    );
    expect(first).toMatchObject({
      outcome: "capacity_hold",
      deliveryStatus: "failed",
    });
    if (first.outcome !== "capacity_hold") {
      throw new Error("Expected a Capacity Hold.");
    }
    const second = await retryService.submit(
      publishedEvent.slug,
      values,
      new Headers(),
    );
    expect(second).toMatchObject({
      outcome: "capacity_hold",
      deliveryStatus: "sent",
      registrationId: first.registrationId,
      verificationExpiresAt: first.verificationExpiresAt,
      capacityHoldExpiresAt: first.capacityHoldExpiresAt,
    });
    expect(tokens).toHaveLength(2);
    expect(tokens[0]).not.toBe(tokens[1]);
  });
});
