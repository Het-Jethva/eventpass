import { generateKeyPairSync, randomUUID } from "node:crypto";

import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { afterAll, beforeAll, expect, it } from "vitest";

import { describeWithDatabase, testDatabaseUrl } from "@/lib/test-db-helper";
import {
  event,
  eventStaff,
  registration,
  ticket,
  user,
} from "../../../lib/db/schema";
import { signTicket } from "../../tickets/ticket-crypto";
import { createScannerPreparationService } from "./scanner-preparation";

const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "P-256",
});

describeWithDatabase("Scanner preparation application service", () => {
  const client = new Pool({ connectionString: testDatabaseUrl! });
  const database = drizzle({ client });

  beforeAll(async () => {
    await database.execute("select 1");
  });

  afterAll(async () => {
    await client.end();
  });

  it("returns only the minimum authorized Offline Event Snapshot", async () => {
    const rollback = Symbol("rollback scanner preparation integration test");
    try {
      await database.transaction(async (transaction) => {
        const now = new Date("2030-01-02T09:30:00.000Z");
        const service = createScannerPreparationService({
          database: transaction as unknown as typeof database,
          now: () => now,
          getSigningKey: () => ({ id: "integration-key", privateKey }),
          getVerificationKeys: () => ({
            "integration-key": publicKey.export({ format: "jwk" }),
          }),
        });
        const [volunteer] = await transaction
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
            name: "Offline admission test",
            description: "Exercises privacy-minimal scanner preparation.",
            slug: `offline-test-${randomUUID()}`,
            status: "published",
            eventTimeZone: "UTC",
            startsAt: new Date("2030-01-02T12:00:00.000Z"),
            endsAt: new Date("2030-01-02T14:00:00.000Z"),
            venueName: "Test Venue",
            venueAddress: "Test address",
            capacity: 5,
            registrationOpensAt: new Date("2029-12-01T00:00:00.000Z"),
            registrationClosesAt: new Date("2030-01-02T12:00:00.000Z"),
            checkInOpensAt: new Date("2030-01-02T10:00:00.000Z"),
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
            email: "private@example.com",
            normalizedEmail: "private@example.com",
            status: "confirmed",
            capacityOutcome: "capacity_hold",
            verifiedAt: new Date("2030-01-01T12:00:00.000Z"),
          })
          .returning({ id: registration.id });
        const ticketId = randomUUID();
        await transaction.insert(ticket).values({
          id: ticketId,
          eventId: createdEvent!.id,
          registrationId: createdRegistration!.id,
          code: "0123456789",
          signedPayload: signTicket(
            { eventId: createdEvent!.id, ticketId },
            { id: "integration-key", privateKey },
          ),
          signingKeyId: "integration-key",
        });

        const result = await service.prepareOfflineScanner({
          eventId: createdEvent!.id,
          actorUserId: volunteer!.id,
          scannerDeviceId: randomUUID(),
          scannerDeviceLabel: "Main entrance phone",
        });

        expect(result.outcome).toBe("prepared");
        if (result.outcome !== "prepared") throw new Error("Expected snapshot");
        expect(Object.keys(result.snapshot).sort()).toEqual([
          "authorization",
          "event",
          "generatedAt",
          "scannerDevice",
          "serverTimeAnchor",
          "tickets",
          "verificationKeys",
          "version",
        ]);
        expect(result.snapshot.tickets).toEqual([
          {
            ticketId,
            ticketCode: "0123456789",
            displayName: "Ada Lovelace",
            validityState: "active",
            existingCheckInState: "not_checked_in",
          },
        ]);
        expect(JSON.stringify(result.snapshot)).not.toContain(
          "private@example.com",
        );
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
