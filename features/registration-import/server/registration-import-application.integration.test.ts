import { generateKeyPairSync, randomUUID } from "node:crypto";

import { Pool } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  auditEntry,
  event,
  eventStaff,
  registration,
  registrationField,
  ticket,
  user,
} from "../../../lib/db/schema";
import { verifyTicket } from "../../tickets/ticket-crypto";

import { createRegistrationImportService } from "./registration-import-application";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;
const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "P-256",
});

describeWithDatabase("Registration import application service", () => {
  const client = new Pool({ connectionString: testDatabaseUrl! });
  const database = drizzle({ client });

  beforeAll(async () => {
    await database.execute("select 1");
  });

  afterAll(async () => {
    await client.end();
  });

  it("atomically imports confirmed Registrations and signed Tickets, audits once, and retries safely", async () => {
    const rollback = Symbol("rollback Registration import integration test");
    try {
      await database.transaction(async (transaction) => {
        const [organizer] = await transaction
          .insert(user)
          .values({
            name: "Import Organizer",
            email: `import-${randomUUID()}@example.com`,
            emailVerified: true,
          })
          .returning({ id: user.id });
        const [createdEvent] = await transaction
          .insert(event)
          .values({
            name: "Import integration test",
            description: "Exercises atomic Registration import.",
            slug: `import-test-${randomUUID()}`,
            status: "published",
            eventTimeZone: "UTC",
            startsAt: new Date("2030-03-02T12:00:00.000Z"),
            endsAt: new Date("2030-03-02T14:00:00.000Z"),
            venueName: "Test Venue",
            venueAddress: "Test address",
            capacity: 2,
            registrationOpensAt: new Date("2030-01-01T00:00:00.000Z"),
            registrationClosesAt: new Date("2030-03-02T12:00:00.000Z"),
            checkInOpensAt: new Date("2030-03-02T11:00:00.000Z"),
            checkInClosesAt: new Date("2030-03-02T14:00:00.000Z"),
            publishedAt: new Date("2030-01-01T00:00:00.000Z"),
          })
          .returning({ id: event.id });
        await transaction.insert(eventStaff).values({
          eventId: createdEvent!.id,
          userId: organizer!.id,
          role: "organizer",
        });
        const fieldId = randomUUID();
        await transaction.insert(registrationField).values({
          id: fieldId,
          eventId: createdEvent!.id,
          answerType: "short_text",
          label: "Club",
          required: true,
          position: 0,
        });

        const codes = ["0123456789", "ABCDEFGHJK"];
        let codeIndex = 0;
        const service = createRegistrationImportService({
          database: transaction as unknown as typeof database,
          getSigningKey: () => ({ id: "import-key", privateKey }),
          now: () => new Date("2030-02-01T12:00:00.000Z"),
          createTicketCode: () => codes[codeIndex++]!,
          createTicketId: () => randomUUID(),
          createManagementToken: () => randomUUID().replaceAll("-", ""),
        });
        const preview = await service.previewImport(
          createdEvent!.id,
          organizer!.id,
          `name,email,Club\n=Ada,ada-${randomUUID()}@example.com,Math\nGrace,grace-${randomUUID()}@example.com,Navy`,
        );
        expect(preview).toMatchObject({
          canConfirm: true,
          projectedCapacity: { imported: 2, remaining: 0 },
        });

        const first = await service.confirmImport(
          createdEvent!.id,
          organizer!.id,
          preview!.id,
        );
        const retry = await service.confirmImport(
          createdEvent!.id,
          organizer!.id,
          preview!.id,
        );
        expect(first).toEqual({
          outcome: "completed",
          importedCount: 2,
          alreadyCompleted: false,
        });
        expect(retry).toEqual({
          outcome: "completed",
          importedCount: 2,
          alreadyCompleted: true,
        });

        const imported = await transaction
          .select()
          .from(registration)
          .where(eq(registration.eventId, createdEvent!.id));
        const issuedTickets = await transaction
          .select()
          .from(ticket)
          .where(eq(ticket.eventId, createdEvent!.id));
        expect(imported).toHaveLength(2);
        expect(imported.every((row) => row.status === "confirmed" && row.source === "imported")).toBe(true);
        expect(issuedTickets).toHaveLength(2);
        expect(
          issuedTickets.every(
            (row) =>
              verifyTicket(row.signedPayload, { "import-key": publicKey }).valid,
          ),
        ).toBe(true);
        expect(
          await transaction
            .select()
            .from(auditEntry)
            .where(eq(auditEntry.action, "registration.imported")),
        ).toHaveLength(1);

        const exported = await service.exportRegistrations(
          createdEvent!.id,
          organizer!.id,
        );
        expect(exported?.csv).toContain("'=Ada");
        expect(exported?.csv).not.toContain("signedPayload");
        expect(exported?.csv).not.toContain("managementToken");
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });

  it("refuses an over-capacity preview without creating partial records", async () => {
    const rollback = Symbol("rollback invalid Registration import test");
    try {
      await database.transaction(async (transaction) => {
        const [organizer] = await transaction
          .insert(user)
          .values({
            name: "Capacity Organizer",
            email: `capacity-import-${randomUUID()}@example.com`,
            emailVerified: true,
          })
          .returning({ id: user.id });
        const [createdEvent] = await transaction
          .insert(event)
          .values({
            name: "Import capacity test",
            description: "Exercises all-or-nothing capacity validation.",
            slug: `import-capacity-${randomUUID()}`,
            status: "published",
            eventTimeZone: "UTC",
            startsAt: new Date("2030-03-02T12:00:00.000Z"),
            endsAt: new Date("2030-03-02T14:00:00.000Z"),
            venueName: "Test Venue",
            venueAddress: "Test address",
            capacity: 1,
            registrationOpensAt: new Date("2030-01-01T00:00:00.000Z"),
            registrationClosesAt: new Date("2030-03-02T12:00:00.000Z"),
            checkInOpensAt: new Date("2030-03-02T11:00:00.000Z"),
            checkInClosesAt: new Date("2030-03-02T14:00:00.000Z"),
            publishedAt: new Date("2030-01-01T00:00:00.000Z"),
          })
          .returning({ id: event.id });
        await transaction.insert(eventStaff).values({
          eventId: createdEvent!.id,
          userId: organizer!.id,
          role: "owner",
        });
        const service = createRegistrationImportService({
          database: transaction as unknown as typeof database,
          getSigningKey: () => ({ id: "import-key", privateKey }),
          now: () => new Date("2030-02-01T12:00:00.000Z"),
        });
        const preview = await service.previewImport(
          createdEvent!.id,
          organizer!.id,
          `name,email\nAda,ada-${randomUUID()}@example.com\nGrace,grace-${randomUUID()}@example.com`,
        );
        expect(preview?.canConfirm).toBe(false);
        expect(
          await service.confirmImport(
            createdEvent!.id,
            organizer!.id,
            preview!.id,
          ),
        ).toEqual({ outcome: "invalid" });
        expect(
          await transaction
            .select()
            .from(registration)
            .where(eq(registration.eventId, createdEvent!.id)),
        ).toHaveLength(0);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
