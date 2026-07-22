import { generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";

import { Pool } from "@neondatabase/serverless";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  capacityHold,
  event,
  registration,
  registrationVerification,
  ticket,
} from "../../../lib/db/schema";
import { digestBearerToken, createTicketApplicationService } from "./ticket-application";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;
const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });

describeWithDatabase("Ticket application service", () => {
  const client = new Pool({ connectionString: testDatabaseUrl! });
  const database = drizzle({ client });
  const eventIds: string[] = [];
  let managementTokenSequence = 0;
  const service = createTicketApplicationService({
    database,
    now: () => new Date("2030-01-01T12:00:00.000Z"),
    getSigningKey: () => ({ id: "integration-key", privateKey }),
    sendTicketEmail: async () => undefined,
    createManagementToken: () =>
      randomBytes(32 + (managementTokenSequence++ % 2)).toString("base64url"),
  });

  async function createHeldRegistration(expiresAt = new Date("2030-01-01T12:15:00.000Z")) {
    const [createdEvent] = await database
      .insert(event)
      .values({
        name: "Ticket integration test",
        description: "Exercises confirmation and Ticket issuance.",
        slug: `ticket-test-${randomUUID()}`,
        status: "published",
        eventTimeZone: "UTC",
        startsAt: new Date("2030-01-02T12:00:00.000Z"),
        endsAt: new Date("2030-01-02T14:00:00.000Z"),
        venueName: "Test Venue",
        venueAddress: "Test address",
        capacity: 5,
        registrationOpensAt: new Date("2029-12-01T00:00:00.000Z"),
        registrationClosesAt: new Date("2030-01-02T12:00:00.000Z"),
        checkInOpensAt: new Date("2030-01-02T11:00:00.000Z"),
        checkInClosesAt: new Date("2030-01-02T14:00:00.000Z"),
        publishedAt: new Date("2029-12-01T00:00:00.000Z"),
      })
      .returning({ id: event.id, slug: event.slug });
    eventIds.push(createdEvent!.id);
    const [createdRegistration] = await database
      .insert(registration)
      .values({
        eventId: createdEvent!.id,
        attendeeName: "Ada Lovelace",
        email: "ada@example.com",
        normalizedEmail: "ada@example.com",
        capacityOutcome: "capacity_hold",
      })
      .returning({ id: registration.id });
    const verificationToken = randomBytes(32).toString("base64url");
    await database.insert(registrationVerification).values({
      registrationId: createdRegistration!.id,
      tokenDigest: digestBearerToken(verificationToken),
      expiresAt,
    });
    await database.insert(capacityHold).values({
      registrationId: createdRegistration!.id,
      expiresAt,
    });
    return {
      event: createdEvent!,
      registrationId: createdRegistration!.id,
      verificationToken,
    };
  }

  beforeAll(async () => {
    await database.execute("select 1");
  });

  afterAll(async () => {
    if (eventIds.length > 0) {
      const registrations = await database
        .select({ id: registration.id })
        .from(registration)
        .where(inArray(registration.eventId, eventIds));
      const registrationIds = registrations.map(({ id }) => id);
      if (registrationIds.length > 0) {
        await database.delete(ticket).where(inArray(ticket.registrationId, registrationIds));
        await database
          .delete(registrationVerification)
          .where(inArray(registrationVerification.registrationId, registrationIds));
        await database
          .delete(capacityHold)
          .where(inArray(capacityHold.registrationId, registrationIds));
        await database.delete(registration).where(inArray(registration.id, registrationIds));
      }
      await database.delete(event).where(inArray(event.id, eventIds));
    }
    await client.end();
  });

  it("claims an unexpired Capacity Hold exactly once and issues one active Ticket", async () => {
    const held = await createHeldRegistration();

    const first = await service.verifyRegistration(held.event.slug, held.verificationToken);
    const second = await service.verifyRegistration(held.event.slug, held.verificationToken);

    expect(first.outcome).toBe("confirmed");
    expect(second).toEqual({ outcome: "consumed" });
    const [confirmed] = await database
      .select({ status: registration.status, verifiedAt: registration.verifiedAt })
      .from(registration)
      .where(eq(registration.id, held.registrationId));
    expect(confirmed?.status).toBe("confirmed");
    expect(confirmed?.verifiedAt).toEqual(new Date("2030-01-01T12:00:00.000Z"));
    const issued = await database
      .select({ code: ticket.code, status: ticket.status })
      .from(ticket)
      .where(and(eq(ticket.registrationId, held.registrationId), eq(ticket.status, "active")));
    expect(issued).toHaveLength(1);
    expect(issued[0]?.code).toMatch(/^[0-9A-HJKMNP-TV-Z]{10}$/);
  });

  it("expires an unclaimed Registration instead of issuing a Ticket", async () => {
    const held = await createHeldRegistration(new Date("2030-01-01T11:59:59.000Z"));

    expect(await service.verifyRegistration(held.event.slug, held.verificationToken)).toEqual({
      outcome: "expired",
    });
    const [expired] = await database
      .select({ status: registration.status })
      .from(registration)
      .where(eq(registration.id, held.registrationId));
    expect(expired?.status).toBe("expired");
    expect(
      await database.select().from(ticket).where(eq(ticket.registrationId, held.registrationId)),
    ).toHaveLength(0);
  });

  it("rejects malformed and Event-mismatched capabilities safely", async () => {
    const held = await createHeldRegistration();
    const other = await createHeldRegistration();

    expect(await service.verifyRegistration(held.event.slug, "not-a-token")).toEqual({
      outcome: "invalid",
    });
    expect(await service.verifyRegistration(other.event.slug, held.verificationToken)).toEqual({
      outcome: "mismatched",
    });
  });
});
