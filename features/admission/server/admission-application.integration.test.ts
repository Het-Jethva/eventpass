import { generateKeyPairSync, randomUUID } from "node:crypto";

import { Pool } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  checkIn,
  event,
  eventStaff,
  registration,
  scanAttempt,
  ticket,
  user,
} from "../../../lib/db/schema";
import { signTicket } from "../../tickets/ticket-crypto";
import { createAdmissionApplicationService } from "./admission-application";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;
const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "P-256",
});

describeWithDatabase("Admission application service", () => {
  const client = new Pool({ connectionString: testDatabaseUrl! });
  const database = drizzle({ client });

  beforeAll(async () => {
    await database.execute("select 1");
  });

  afterAll(async () => {
    await client.end();
  });

  it("rejects a second admission attempt as a duplicate without creating another active Check-in", async () => {
    const rollback = Symbol("rollback admission integration test");
    try {
      await database.transaction(async (transaction) => {
        const service = createAdmissionApplicationService({
          database: transaction as unknown as typeof database,
          now: () => new Date("2030-01-02T11:30:00.000Z"),
          getVerificationKeys: () => ({ "integration-key": publicKey }),
        });
        const [staffUser] = await transaction
          .insert(user)
          .values({
            name: "Gate Volunteer",
            email: `volunteer-${randomUUID()}@example.com`,
            emailVerified: true,
          })
          .returning({ id: user.id });
        const [createdEvent] = await transaction
          .insert(event)
          .values({
            name: "Admission integration test",
            description: "Exercises authoritative online admission.",
            slug: `admission-test-${randomUUID()}`,
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
          .returning({ id: event.id });
        await transaction.insert(eventStaff).values({
          eventId: createdEvent!.id,
          userId: staffUser!.id,
          role: "check_in_volunteer",
        });
        const [createdRegistration] = await transaction
          .insert(registration)
          .values({
            eventId: createdEvent!.id,
            attendeeName: "Ada Lovelace",
            email: "ada-admission@example.com",
            normalizedEmail: "ada-admission@example.com",
            status: "confirmed",
            capacityOutcome: "capacity_hold",
            verifiedAt: new Date("2030-01-01T12:00:00.000Z"),
          })
          .returning({ id: registration.id });
        const ticketId = randomUUID();
        const signedPayload = signTicket(
          { eventId: createdEvent!.id, ticketId },
          { id: "integration-key", privateKey },
        );
        await transaction.insert(ticket).values({
          id: ticketId,
          eventId: createdEvent!.id,
          registrationId: createdRegistration!.id,
          code: "0123456789",
          signedPayload,
          signingKeyId: "integration-key",
        });

        const first = await service.admitOnline({
          eventId: createdEvent!.id,
          actorUserId: staffUser!.id,
          input: signedPayload,
          inputMethod: "camera",
        });
        const second = await service.admitOnline({
          eventId: createdEvent!.id,
          actorUserId: staffUser!.id,
          input: "01234-56789",
          inputMethod: "manual",
        });

        expect(first).toMatchObject({
          outcome: "accepted",
          attendeeName: "Ada Lovelace",
        });
        expect(second).toMatchObject({
          outcome: "duplicate",
          attendeeName: "Ada Lovelace",
        });
        expect(
          await transaction
            .select()
            .from(checkIn)
            .where(eq(checkIn.ticketId, ticketId)),
        ).toHaveLength(1);
        expect(
          await transaction
            .select()
            .from(scanAttempt)
            .where(eq(scanAttempt.ticketId, ticketId)),
        ).toHaveLength(2);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
