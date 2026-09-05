import { generateKeyPairSync, randomUUID } from "node:crypto";

import { Pool } from "@neondatabase/serverless";
import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { afterAll, beforeAll, expect, it } from "vitest";

import { describeWithDatabase, testDatabaseUrl } from "@/lib/test-db-helper";
import {
  auditEntry,
  checkIn,
  checkInConflict,
  event,
  eventStaff,
  registration,
  scanAttempt,
  ticket,
  user,
} from "../../../lib/db/schema";
import { signTicket } from "../../tickets/ticket-crypto";
import { signScannerAuthorization } from "../scanner-authorization";
import {
  createOfflineSynchronizationService,
  type OfflineScanAttemptInput,
} from "./offline-synchronization";

const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "P-256",
});

describeWithDatabase("Check-in Conflict application service", () => {
  const client = new Pool({ connectionString: testDatabaseUrl! });
  const database = drizzle({ client });

  beforeAll(async () => {
    await database.execute("select 1");
  });

  afterAll(async () => {
    await client.end();
  });

  it("reconciles separate Scanner Devices by Timestamp Confidence and requires a reasoned Organizer choice when confidence is low", async () => {
    const rollback = Symbol("rollback conflict integration test");
    try {
      await database.transaction(async (transaction) => {
        const service = createOfflineSynchronizationService({
          database: transaction as unknown as typeof database,
          now: () => new Date("2030-01-02T11:30:00.000Z"),
          getVerificationKeys: () => ({ "integration-key": publicKey }),
        });
        const staff = await transaction
          .insert(user)
          .values([
            {
              name: "Event Organizer",
              email: `organizer-${randomUUID()}@example.com`,
              emailVerified: true,
            },
            {
              name: "North Gate",
              email: `north-${randomUUID()}@example.com`,
              emailVerified: true,
            },
            {
              name: "South Gate",
              email: `south-${randomUUID()}@example.com`,
              emailVerified: true,
            },
            {
              name: "East Gate",
              email: `east-${randomUUID()}@example.com`,
              emailVerified: true,
            },
          ])
          .returning({ id: user.id });
        const organizerId = staff[0]!.id;
        const northVolunteerId = staff[1]!.id;
        const southVolunteerId = staff[2]!.id;
        const eastVolunteerId = staff[3]!.id;
        const [createdEvent] = await transaction
          .insert(event)
          .values({
            name: "Conflict integration test",
            description: "Exercises cross-device conflict reconciliation.",
            slug: `conflict-test-${randomUUID()}`,
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
            userId: organizerId,
            role: "owner",
          },
          {
            eventId: createdEvent!.id,
            userId: northVolunteerId,
            role: "check_in_volunteer",
          },
          {
            eventId: createdEvent!.id,
            userId: southVolunteerId,
            role: "check_in_volunteer",
          },
          {
            eventId: createdEvent!.id,
            userId: eastVolunteerId,
            role: "check_in_volunteer",
          },
        ]);

        async function createTicket(attendeeName: string, code: string) {
          const attendeeEmail = `${randomUUID()}@example.com`;
          const [createdRegistration] = await transaction
            .insert(registration)
            .values({
              eventId: createdEvent!.id,
              attendeeName,
              email: attendeeEmail,
              normalizedEmail: attendeeEmail,
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
            code,
            signedPayload,
            signingKeyId: "integration-key",
          });
          return { ticketId, signedPayload };
        }

        const northDeviceId = randomUUID();
        const southDeviceId = randomUUID();
        const issuedAt = "2030-01-02T10:30:00.000Z";
        function authorization(volunteerUserId: string, scannerDeviceId: string) {
          return signScannerAuthorization(
            {
              eventId: createdEvent!.id,
              volunteerUserId,
              scannerDeviceId,
              issuedAt,
              expiresAt: "2030-01-02T14:00:00.000Z",
            },
            { id: "integration-key", privateKey },
          );
        }
        function attempt(
          ticketRecord: Awaited<ReturnType<typeof createTicket>>,
          scannerDeviceId: string,
          minutesAfterAnchor: number,
          timestampConfidence: "high" | "low",
        ): OfflineScanAttemptInput {
          return {
            id: randomUUID(),
            eventId: createdEvent!.id,
            ticketId: ticketRecord.ticketId,
            inputDigest: randomUUID().replaceAll("-", "").padEnd(64, "0"),
            inputMethod: "camera",
            capturedOutcome: "provisional",
            deviceRecordedAt: new Date(
              new Date(issuedAt).getTime() + minutesAfterAnchor * 60_000,
            ).toISOString(),
            serverTimeAnchor: issuedAt,
            monotonicElapsedMs: minutesAfterAnchor * 60_000,
            timestampConfidence,
            signedTicket: ticketRecord.signedPayload,
            scannerDeviceId,
          };
        }

        const automaticTicket = await createTicket("Ada Lovelace", "0123456789");
        const laterAttempt = attempt(automaticTicket, northDeviceId, 50, "high");
        const earlierAttempt = attempt(automaticTicket, southDeviceId, 40, "high");
        await service.synchronizeOfflineAttempts({
          authorization: authorization(northVolunteerId, northDeviceId),
          attempts: [laterAttempt],
        });
        const automatic = await service.synchronizeOfflineAttempts({
          authorization: authorization(southVolunteerId, southDeviceId),
          attempts: [earlierAttempt],
        });
        const reconciledLoser = await service.synchronizeOfflineAttempts({
          authorization: authorization(northVolunteerId, northDeviceId),
          attempts: [laterAttempt],
        });

        expect(automatic).toMatchObject({
          outcome: "acknowledged",
          results: [{ id: earlierAttempt.id, outcome: "accepted" }],
        });
        expect(reconciledLoser).toMatchObject({
          outcome: "acknowledged",
          results: [{ id: laterAttempt.id, outcome: "duplicate", changed: true }],
        });
        expect(
          await transaction
            .select({ checkedInAt: checkIn.checkedInAt })
            .from(checkIn)
            .where(
              and(
                eq(checkIn.ticketId, automaticTicket.ticketId),
                isNull(checkIn.invalidatedAt),
              ),
            ),
        ).toEqual([{ checkedInAt: new Date("2030-01-02T11:10:00.000Z") }]);

        const eastDeviceId = randomUUID();
        const lateLowAttempt = attempt(
          automaticTicket,
          eastDeviceId,
          55,
          "low",
        );
        const lateLow = await service.synchronizeOfflineAttempts({
          authorization: authorization(eastVolunteerId, eastDeviceId),
          attempts: [lateLowAttempt],
        });
        expect(lateLow).toMatchObject({
          outcome: "acknowledged",
          results: [{ id: lateLowAttempt.id, outcome: "duplicate" }],
        });
        expect(
          await transaction
            .select({
              checkedInAt: checkIn.checkedInAt,
              invalidatedAt: checkIn.invalidatedAt,
            })
            .from(checkIn)
            .where(
              and(
                eq(checkIn.ticketId, automaticTicket.ticketId),
                isNull(checkIn.invalidatedAt),
              ),
            ),
        ).toEqual([
          {
            checkedInAt: new Date("2030-01-02T11:10:00.000Z"),
            invalidatedAt: null,
          },
        ]);
        expect(
          await transaction
            .select({ status: checkInConflict.status })
            .from(checkInConflict)
            .where(eq(checkInConflict.ticketId, automaticTicket.ticketId)),
        ).toEqual([{ status: "resolved_auto" }]);

        const reviewedTicket = await createTicket("Grace Hopper", "123456789A");
        const highAttempt = attempt(reviewedTicket, northDeviceId, 45, "high");
        const lowAttempt = attempt(reviewedTicket, southDeviceId, 35, "low");
        await service.synchronizeOfflineAttempts({
          authorization: authorization(northVolunteerId, northDeviceId),
          attempts: [highAttempt],
        });
        const reviewRequired = await service.synchronizeOfflineAttempts({
          authorization: authorization(southVolunteerId, southDeviceId),
          attempts: [lowAttempt],
        });
        expect(reviewRequired).toMatchObject({
          outcome: "acknowledged",
          results: [{ id: lowAttempt.id, outcome: "conflict" }],
        });

        const conflicts = await service.listCheckInConflicts({
          eventId: createdEvent!.id,
          actorUserId: organizerId,
        });
        expect(conflicts).toMatchObject([
          {
            status: "unresolved",
            attendeeName: "Grace Hopper",
            attempts: [
              { id: lowAttempt.id, timestampConfidence: "low" },
              { id: highAttempt.id, timestampConfidence: "high" },
            ],
          },
        ]);

        await service.resolveCheckInConflict({
          conflictId: conflicts[0]!.id,
          actorUserId: organizerId,
          authoritativeAttemptId: lowAttempt.id,
          reason: "South Gate confirmed the earlier presentation with the lead.",
        });
        const selected = await service.synchronizeOfflineAttempts({
          authorization: authorization(southVolunteerId, southDeviceId),
          attempts: [lowAttempt],
        });
        const notSelected = await service.synchronizeOfflineAttempts({
          authorization: authorization(northVolunteerId, northDeviceId),
          attempts: [highAttempt],
        });

        expect(selected).toMatchObject({
          results: [{ outcome: "accepted", changed: true }],
        });
        expect(notSelected).toMatchObject({
          results: [{ outcome: "duplicate", changed: true }],
        });
        expect(
          await transaction
            .select()
            .from(scanAttempt)
            .where(eq(scanAttempt.ticketId, reviewedTicket.ticketId)),
        ).toHaveLength(2);
        expect(
          await transaction
            .select({ reason: auditEntry.reason })
            .from(auditEntry)
            .where(eq(auditEntry.action, "check_in_conflict.resolved")),
        ).toContainEqual({
          reason: "South Gate confirmed the earlier presentation with the lead.",
        });
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
