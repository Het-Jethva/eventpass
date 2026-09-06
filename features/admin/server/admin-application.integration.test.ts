import { randomUUID } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";
import { expect, it } from "vitest";

import { describeWithDatabase, testDatabaseUrl } from "@/lib/test-db-helper";
import {
  PlatformAdminError,
  SupportAccessRequiredError,
} from "@/features/admin/admin-policy";
import {
  auditEntry,
  event,
  session,
  supportAccess,
  user,
} from "@/lib/db/schema";

// The admin service uses the shared `db` (DATABASE_URL), while integration
// suites are pointed at TEST_DATABASE_URL. Redirect the shared client before
// the service modules are first imported; each test file runs in its own
// module registry, so this cannot leak into other suites.
if (testDatabaseUrl) {
  process.env.DATABASE_URL = testDatabaseUrl;
}

async function loadAdminApplication() {
  const [application, database] = await Promise.all([
    import("@/features/admin/server/admin-application"),
    import("@/lib/db"),
  ]);
  return { ...application, db: database.db };
}

function uniqueEmail(prefix: string) {
  return `${prefix}-${randomUUID()}@example.com`;
}

describeWithDatabase("Admin application service", () => {
  it("suspending a staff account drops their sessions immediately", async () => {
    const { suspendStaffAccount, db } = await loadAdminApplication();
    const [admin, target] = await Promise.all([
      db
        .insert(user)
        .values({
          name: "Platform Admin",
          email: uniqueEmail("suspend-admin"),
          emailVerified: true,
          isPlatformAdmin: true,
        })
        .returning({ id: user.id })
        .then((rows) => rows[0]!),
      db
        .insert(user)
        .values({
          name: "Abusive Staffer",
          email: uniqueEmail("suspend-target"),
          emailVerified: true,
        })
        .returning({ id: user.id })
        .then((rows) => rows[0]!),
    ]);
    try {
      const now = new Date();
      await db.insert(session).values([
        {
          token: `target-session-a-${randomUUID()}`,
          userId: target.id,
          expiresAt: new Date(now.getTime() + 3_600_000),
          updatedAt: now,
        },
        {
          token: `target-session-b-${randomUUID()}`,
          userId: target.id,
          expiresAt: new Date(now.getTime() + 3_600_000),
          updatedAt: now,
        },
        {
          token: `admin-session-${randomUUID()}`,
          userId: admin.id,
          expiresAt: new Date(now.getTime() + 3_600_000),
          updatedAt: now,
        },
      ]);

      await suspendStaffAccount({
        actorUserId: admin.id,
        targetUserId: target.id,
        reason: "Spamming attendees.",
      });

      const [flagged] = await db
        .select({ suspended: user.suspended })
        .from(user)
        .where(eq(user.id, target.id));
      expect(flagged?.suspended).toBe(true);
      // The suspended account loses every session; the admin's own session
      // is untouched.
      expect(
        await db
          .select({ userId: session.userId })
          .from(session)
          .where(inArray(session.userId, [target.id, admin.id])),
      ).toEqual([{ userId: admin.id }]);
      expect(
        await db
          .select({ reason: auditEntry.reason })
          .from(auditEntry)
          .where(
            and(
              eq(auditEntry.action, "admin.account_suspended"),
              eq(auditEntry.targetId, target.id),
            ),
          ),
      ).toEqual([{ reason: "Spamming attendees." }]);
    } finally {
      // Audit Entries are immutable by database trigger (by design), so the
      // users, events, and audit rows created here stay behind. Fixtures use
      // random identifiers per run, so leftovers cannot collide. Only rows
      // nothing references may be removed.
      await db.delete(session).where(eq(session.userId, admin.id));
    }
  });

  it("grantSupportAccess rejects unbounded durations and unknown events", async () => {
    const { grantSupportAccess, db } = await loadAdminApplication();
    const [admin] = await db
      .insert(user)
      .values({
        name: "Platform Admin",
        email: uniqueEmail("grant-admin"),
        emailVerified: true,
        isPlatformAdmin: true,
      })
      .returning({ id: user.id });
    try {
      await expect(
        grantSupportAccess({
          actorUserId: admin!.id,
          eventId: randomUUID(),
          reason: "A year of access.",
          durationMinutes: 525_600,
        }),
      ).rejects.toThrow(PlatformAdminError);
      await expect(
        grantSupportAccess({
          actorUserId: admin!.id,
          eventId: randomUUID(),
          reason: "No such event.",
        }),
      ).rejects.toThrow(PlatformAdminError);
    } finally {
      // See above: audit-immutable rows stay behind by design.
    }
  });

  it("revoking Support Access closes the grant and its audit trail stays", async () => {
    const {
      grantSupportAccess,
      revokeSupportAccess,
      getEventAttendeeDataForSupport,
      db,
    } = await loadAdminApplication();
    const [admin] = await db
      .insert(user)
      .values({
        name: "Platform Admin",
        email: uniqueEmail("revoke-admin"),
        emailVerified: true,
        isPlatformAdmin: true,
      })
      .returning({ id: user.id });
    const [createdEvent] = await db
      .insert(event)
      .values({
        name: "Support revocation test",
        description: "Exercises support access revocation.",
        slug: `support-revoke-${randomUUID()}`,
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
    try {
      const grant = await grantSupportAccess({
        actorUserId: admin!.id,
        eventId: createdEvent!.id,
        reason: "Attendee reports a missing ticket.",
      });

      await revokeSupportAccess({
        actorUserId: admin!.id,
        supportAccessId: grant.id,
        reason: "Ticket found, closing early.",
      });

      const [revoked] = await db
        .select({ revokedAt: supportAccess.revokedAt })
        .from(supportAccess)
        .where(eq(supportAccess.id, grant.id));
      expect(revoked?.revokedAt).toBeInstanceOf(Date);
      // A revoked grant no longer opens attendee data.
      await expect(
        getEventAttendeeDataForSupport({
          actorUserId: admin!.id,
          eventId: createdEvent!.id,
        }),
      ).rejects.toThrow(SupportAccessRequiredError);
      // And revoking twice is a no-op error, not a second audit row.
      await expect(
        revokeSupportAccess({
          actorUserId: admin!.id,
          supportAccessId: grant.id,
          reason: "Again.",
        }),
      ).rejects.toThrow(SupportAccessRequiredError);
      expect(
        await db
          .select({ id: auditEntry.id })
          .from(auditEntry)
          .where(
            and(
              eq(auditEntry.action, "admin.support_access_revoked"),
              eq(auditEntry.eventId, createdEvent!.id),
            ),
          ),
      ).toHaveLength(1);
    } finally {
      // See above: audit-immutable rows stay behind by design.
    }
  });
});
