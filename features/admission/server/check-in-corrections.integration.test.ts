import { generateKeyPairSync, randomUUID } from "node:crypto";

import { Pool } from "@neondatabase/serverless";
import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { afterAll, beforeAll, expect, it } from "vitest";

import { describeWithDatabase, testDatabaseUrl } from "@/lib/test-db-helper";
import {
  auditEntry,
  checkIn,
  checkInReversal,
  event,
  eventStaff,
  registration,
  ticket,
  user,
} from "../../../lib/db/schema";
import { signTicket } from "../../tickets/ticket-crypto";
import { createAdmissionApplicationService } from "./admission-application";
import {
  CheckInCorrectionError,
  createCheckInCorrectionService,
} from "./check-in-correction-application";

const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "P-256",
});

describeWithDatabase("Check-in correction application service", () => {
  const client = new Pool({ connectionString: testDatabaseUrl! });
  const database = drizzle({ client });

  beforeAll(async () => {
    await database.execute("select 1");
  });

  afterAll(async () => {
    await client.end();
  });

  it("limits Quick Reversal, preserves history, and makes the Ticket admissible again", async () => {
    const rollback = Symbol("rollback correction integration test");
    try {
      await database.transaction(async (transaction) => {
        const now = new Date("2030-01-02T11:30:00.000Z");
        const corrections = createCheckInCorrectionService({
          database: transaction as unknown as typeof database,
          now: () => now,
        });
        const expiredCorrections = createCheckInCorrectionService({
          database: transaction as unknown as typeof database,
          now: () => new Date("2030-01-02T11:30:11.000Z"),
        });
        const admission = createAdmissionApplicationService({
          database: transaction as unknown as typeof database,
          now: () => now,
          getVerificationKeys: () => ({ "integration-key": publicKey }),
        });
        const [volunteer] = await transaction
          .insert(user)
          .values({
            name: "Gate Volunteer",
            email: `correction-volunteer-${randomUUID()}@example.com`,
            emailVerified: true,
          })
          .returning({ id: user.id });
        const [createdEvent] = await transaction
          .insert(event)
          .values({
            name: "Check-in correction test",
            description: "Exercises reasoned admission corrections.",
            slug: `correction-test-${randomUUID()}`,
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
          userId: volunteer!.id,
          role: "check_in_volunteer",
        });
        const [createdRegistration] = await transaction
          .insert(registration)
          .values({
            eventId: createdEvent!.id,
            attendeeName: "Ada Lovelace",
            email: "ada-correction@example.com",
            normalizedEmail: "ada-correction@example.com",
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
          code: "BCDEFGHJKM",
          signedPayload,
          signingKeyId: "integration-key",
        });
        const [createdCheckIn] = await transaction
          .insert(checkIn)
          .values({
            eventId: createdEvent!.id,
            ticketId,
            actorUserId: volunteer!.id,
            checkedInAt: new Date("2030-01-02T11:29:40.000Z"),
          })
          .returning({ id: checkIn.id });

        const correctionInput = {
          eventId: createdEvent!.id,
          checkInId: createdCheckIn!.id,
          actorUserId: volunteer!.id,
          reason: "Scanned the next attendee's Ticket by mistake.",
        };
        await expect(
          expiredCorrections.reverseCheckIn(correctionInput),
        ).rejects.toBeInstanceOf(CheckInCorrectionError);
        const reversed = await corrections.reverseCheckIn(correctionInput);
        const readmission = await admission.admitOnline({
          eventId: createdEvent!.id,
          actorUserId: volunteer!.id,
          clientAttemptId: randomUUID(),
          input: signedPayload,
          inputMethod: "camera",
        });

        expect(reversed).toEqual({ outcome: "reversed", kind: "quick" });
        expect(readmission.outcome).toBe("accepted");
        expect(
          await transaction
            .select()
            .from(checkIn)
            .where(eq(checkIn.ticketId, ticketId)),
        ).toHaveLength(2);
        expect(
          await transaction
            .select()
            .from(checkIn)
            .where(
              and(eq(checkIn.ticketId, ticketId), isNull(checkIn.invalidatedAt)),
            ),
        ).toHaveLength(1);
        expect(
          await transaction
            .select()
            .from(checkInReversal)
            .where(eq(checkInReversal.checkInId, createdCheckIn!.id)),
        ).toHaveLength(1);
        expect(
          await transaction
            .select()
            .from(auditEntry)
            .where(eq(auditEntry.action, "check_in.reversed")),
        ).toHaveLength(1);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });

  it("permits only a reasoned Organizer override outside the Check-in Window", async () => {
    const rollback = Symbol("rollback override integration test");
    try {
      await database.transaction(async (transaction) => {
        const [organizer, volunteer] = await transaction
          .insert(user)
          .values([
            {
              name: "Event Organizer",
              email: `override-organizer-${randomUUID()}@example.com`,
              emailVerified: true,
            },
            {
              name: "Gate Volunteer",
              email: `override-volunteer-${randomUUID()}@example.com`,
              emailVerified: true,
            },
          ])
          .returning({ id: user.id });
        const [createdEvent] = await transaction
          .insert(event)
          .values({
            name: "Outside-window override test",
            description: "Exercises accountable Organizer admission.",
            slug: `override-test-${randomUUID()}`,
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
        await transaction.insert(eventStaff).values([
          {
            eventId: createdEvent!.id,
            userId: organizer!.id,
            role: "organizer",
          },
          {
            eventId: createdEvent!.id,
            userId: volunteer!.id,
            role: "check_in_volunteer",
          },
        ]);
        const [createdRegistration] = await transaction
          .insert(registration)
          .values({
            eventId: createdEvent!.id,
            attendeeName: "Grace Hopper",
            email: "grace-override@example.com",
            normalizedEmail: "grace-override@example.com",
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
          code: "NPQRSTVWXY",
          signedPayload,
          signingKeyId: "integration-key",
        });
        const admission = createAdmissionApplicationService({
          database: transaction as unknown as typeof database,
          now: () => new Date("2030-01-02T10:30:00.000Z"),
          getVerificationKeys: () => ({ "integration-key": publicKey }),
        });

        const volunteerAttempt = await admission.admitOnline({
          eventId: createdEvent!.id,
          actorUserId: volunteer!.id,
          clientAttemptId: randomUUID(),
          input: signedPayload,
          inputMethod: "camera",
          overrideReason: "Not authorized to override.",
        });
        const organizerAttempt = await admission.admitOnline({
          eventId: createdEvent!.id,
          actorUserId: organizer!.id,
          clientAttemptId: randomUUID(),
          input: signedPayload,
          inputMethod: "camera",
          overrideReason: "Venue opened early after safety checks.",
        });

        expect(volunteerAttempt.outcome).toBe("outside_window");
        expect(organizerAttempt.outcome).toBe("accepted");
        expect(
          await transaction
            .select({ reason: auditEntry.reason })
            .from(auditEntry)
            .where(eq(auditEntry.action, "check_in.outside_window_override")),
        ).toEqual([{ reason: "Venue opened early after safety checks." }]);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });

});
