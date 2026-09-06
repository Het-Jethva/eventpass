import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { expect, it } from "vitest";

import { describeWithDatabase, testDatabaseUrl } from "@/lib/test-db-helper";
import {
  event,
  eventStaff,
  ownershipTransfer,
  user,
} from "@/lib/db/schema";

// See admin-application.integration.test.ts: the staffing service also uses
// the shared `db`, so point it at the test database before first import.
if (testDatabaseUrl) {
  process.env.DATABASE_URL = testDatabaseUrl;
}

async function loadStaffingApplication() {
  const [application, database] = await Promise.all([
    import("@/features/staffing/server/staffing-application"),
    import("@/lib/db"),
  ]);
  return { ...application, db: database.db };
}

function uniqueEmail(prefix: string) {
  return `${prefix}-${randomUUID()}@example.com`;
}

describeWithDatabase("Ownership transfer withdrawal", () => {
  it("lets the proposing owner withdraw, then blocks accept and re-proposal rules hold", async () => {
    const {
      proposeOwnershipTransfer,
      acceptOwnershipTransfer,
      withdrawOwnershipTransfer,
      StaffingAuthorizationError,
      OwnershipTransferUnavailableError,
      db,
    } = await loadStaffingApplication();

    const [owner, organizer] = await Promise.all([
      db
        .insert(user)
        .values({
          name: "Current Owner",
          email: uniqueEmail("transfer-owner"),
          emailVerified: true,
        })
        .returning({ id: user.id })
        .then((rows) => rows[0]!),
      db
        .insert(user)
        .values({
          name: "Next Owner",
          email: uniqueEmail("transfer-organizer"),
          emailVerified: true,
        })
        .returning({ id: user.id })
        .then((rows) => rows[0]!),
    ]);
    const [createdEvent] = await db
      .insert(event)
      .values({
        name: "Transfer withdrawal test",
        description: "Exercises ownership transfer withdrawal.",
        slug: `transfer-withdraw-${randomUUID()}`,
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
    await db.insert(eventStaff).values([
      { eventId: createdEvent!.id, userId: owner.id, role: "owner" },
      { eventId: createdEvent!.id, userId: organizer.id, role: "organizer" },
    ]);

    try {
      const transfer = await proposeOwnershipTransfer(
        createdEvent!.id,
        organizer.id,
        owner.id,
      );

      // The proposed owner cannot withdraw someone else's proposal.
      await expect(
        withdrawOwnershipTransfer(transfer.id, organizer.id),
      ).rejects.toThrow(StaffingAuthorizationError);

      await withdrawOwnershipTransfer(transfer.id, owner.id);

      const [withdrawn] = await db
        .select({ revokedAt: ownershipTransfer.revokedAt })
        .from(ownershipTransfer)
        .where(eq(ownershipTransfer.id, transfer.id));
      expect(withdrawn?.revokedAt).toBeInstanceOf(Date);

      // A withdrawn proposal can neither be accepted nor withdrawn again.
      await expect(
        acceptOwnershipTransfer(transfer.id, organizer.id),
      ).rejects.toThrow(OwnershipTransferUnavailableError);
      await expect(
        withdrawOwnershipTransfer(transfer.id, owner.id),
      ).rejects.toThrow(OwnershipTransferUnavailableError);

      // Withdrawing clears the single-pending slot: proposing again works.
      const second = await proposeOwnershipTransfer(
        createdEvent!.id,
        organizer.id,
        owner.id,
      );
      expect(second.id).not.toBe(transfer.id);
    } finally {
      // Audit Entries are immutable by database trigger (by design), so the
      // users, events, transfers, and audit rows created here stay behind.
      // Fixtures use random identifiers per run, so leftovers cannot collide.
    }
  });
});
