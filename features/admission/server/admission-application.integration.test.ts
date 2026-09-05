import { generateKeyPairSync, randomUUID } from "node:crypto";

import { Pool } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { afterAll, beforeAll, expect, it } from "vitest";

import { describeWithDatabase, testDatabaseUrl } from "@/lib/test-db-helper";
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
import { signScannerAuthorization } from "../scanner-authorization";
import { createAdmissionApplicationService } from "./admission-application";
import { createOfflineSynchronizationService } from "./offline-synchronization";

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
          clientAttemptId: randomUUID(),
          input: signedPayload,
          inputMethod: "camera",
        });
        const second = await service.admitOnline({
          eventId: createdEvent!.id,
          actorUserId: staffUser!.id,
          clientAttemptId: randomUUID(),
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

  it("acknowledges an at-least-once offline batch without duplicating its Scan Attempt or Check-in", async () => {
    const rollback = Symbol("rollback synchronization integration test");
    try {
      await database.transaction(async (transaction) => {
        const service = createOfflineSynchronizationService({
          database: transaction as unknown as typeof database,
          now: () => new Date("2030-01-02T11:30:00.000Z"),
          getVerificationKeys: () => ({ "integration-key": publicKey }),
        });
        const [staffUser] = await transaction
          .insert(user)
          .values({
            name: "Offline Gate Volunteer",
            email: `offline-volunteer-${randomUUID()}@example.com`,
            emailVerified: true,
          })
          .returning({ id: user.id });
        const [createdEvent] = await transaction
          .insert(event)
          .values({
            name: "Offline synchronization test",
            description: "Exercises idempotent at-least-once synchronization.",
            slug: `offline-sync-${randomUUID()}`,
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
            attendeeName: "Grace Hopper",
            email: "grace-offline@example.com",
            normalizedEmail: "grace-offline@example.com",
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
          code: "123456789A",
          signedPayload,
          signingKeyId: "integration-key",
        });
        const scannerDeviceId = randomUUID();
        const issuedAt = "2030-01-02T10:30:00.000Z";
        const authorization = signScannerAuthorization(
          {
            eventId: createdEvent!.id,
            volunteerUserId: staffUser!.id,
            scannerDeviceId,
            issuedAt,
            expiresAt: "2030-01-02T14:00:00.000Z",
          },
          { id: "integration-key", privateKey },
        );
        const attemptId = randomUUID();
        const batch = {
          authorization,
          attempts: [
            {
              id: attemptId,
              eventId: createdEvent!.id,
              ticketId,
              inputDigest: "a".repeat(64),
              inputMethod: "camera" as const,
              capturedOutcome: "provisional" as const,
              deviceRecordedAt: "2030-01-02T11:15:00.000Z",
              serverTimeAnchor: issuedAt,
              monotonicElapsedMs: 45 * 60 * 1000,
              timestampConfidence: "high" as const,
              signedTicket: signedPayload,
              scannerDeviceId,
            },
          ],
        };

        const first = await service.synchronizeOfflineAttempts(batch);
        const retry = await service.synchronizeOfflineAttempts(batch);

        expect(first).toMatchObject({
          outcome: "acknowledged",
          results: [{ id: attemptId, outcome: "accepted" }],
        });
        expect(retry).toEqual(first);
        expect(
          await transaction
            .select()
            .from(scanAttempt)
            .where(eq(scanAttempt.id, attemptId)),
        ).toHaveLength(1);
        expect(
          await transaction
            .select()
            .from(checkIn)
            .where(eq(checkIn.ticketId, ticketId)),
        ).toHaveLength(1);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
