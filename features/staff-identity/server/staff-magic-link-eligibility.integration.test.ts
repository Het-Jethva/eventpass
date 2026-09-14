import { randomUUID } from "node:crypto";

import { expect, it } from "vitest";

import { describeWithDatabase, pointSharedDatabaseAtTestUrl } from "@/lib/test-db-helper";
import { event, eventStaff, staffInvitation, user } from "@/lib/db/schema";

pointSharedDatabaseAtTestUrl();

async function loadEligibility() {
  const [eligibility, database] = await Promise.all([
    import("./staff-magic-link-eligibility"),
    import("@/lib/db"),
  ]);
  return { ...eligibility, db: database.db };
}

function uniqueEmail(prefix: string) {
  return `${prefix}-${randomUUID()}@example.com`;
}

describeWithDatabase("Staff magic-link eligibility", () => {
  it("allows known staff and pending invitees, and blocks suspended users and Events", async () => {
    const { isEligibleStaffMagicLinkRecipient, db } = await loadEligibility();
    const staffEmail = uniqueEmail("eligible-staff");
    const suspendedEmail = uniqueEmail("eligible-suspended");
    const inviteEmail = uniqueEmail("eligible-invite");
    const suspendedEventInvite = uniqueEmail("eligible-suspended-event");
    const now = new Date();

    const [staff, suspended, owner] = await Promise.all([
      db
        .insert(user)
        .values({
          name: "Eligible Staff",
          email: staffEmail,
          emailVerified: true,
        })
        .returning({ id: user.id })
        .then((rows) => rows[0]!),
      db
        .insert(user)
        .values({
          name: "Suspended Staff",
          email: suspendedEmail,
          emailVerified: true,
          suspended: true,
        })
        .returning({ id: user.id })
        .then((rows) => rows[0]!),
      db
        .insert(user)
        .values({
          name: "Invite Owner",
          email: uniqueEmail("eligible-owner"),
          emailVerified: true,
        })
        .returning({ id: user.id })
        .then((rows) => rows[0]!),
    ]);
    const [liveEvent] = await db
      .insert(event)
      .values({
        name: "Eligibility live",
        description: "Open invitation.",
        slug: `eligible-live-${randomUUID()}`,
        status: "published",
        eventTimeZone: "UTC",
        startsAt: new Date(now.getTime() + 86_400_000),
        endsAt: new Date(now.getTime() + 90_000_000),
        venueName: "Hall",
        venueAddress: "Campus",
        capacity: 10,
        registrationOpensAt: now,
        registrationClosesAt: new Date(now.getTime() + 86_400_000),
        checkInOpensAt: new Date(now.getTime() + 82_800_000),
        checkInClosesAt: new Date(now.getTime() + 90_000_000),
        publishedAt: now,
      })
      .returning({ id: event.id });
    const [pausedEvent] = await db
      .insert(event)
      .values({
        name: "Eligibility paused",
        description: "Suspended Event.",
        slug: `eligible-paused-${randomUUID()}`,
        status: "published",
        eventTimeZone: "UTC",
        startsAt: new Date(now.getTime() + 86_400_000),
        endsAt: new Date(now.getTime() + 90_000_000),
        venueName: "Hall",
        venueAddress: "Campus",
        capacity: 10,
        registrationOpensAt: now,
        registrationClosesAt: new Date(now.getTime() + 86_400_000),
        checkInOpensAt: new Date(now.getTime() + 82_800_000),
        checkInClosesAt: new Date(now.getTime() + 90_000_000),
        publishedAt: now,
        suspended: true,
        suspendedAt: now,
        suspensionReason: "Platform review",
      })
      .returning({ id: event.id });
    await db.insert(eventStaff).values([
      {
        eventId: liveEvent!.id,
        userId: owner.id,
        role: "owner",
      },
      {
        eventId: liveEvent!.id,
        userId: staff.id,
        role: "organizer",
      },
      {
        eventId: liveEvent!.id,
        userId: suspended.id,
        role: "check_in_volunteer",
      },
    ]);
    await db.insert(staffInvitation).values([
      {
        eventId: liveEvent!.id,
        invitedByUserId: owner.id,
        normalizedEmail: inviteEmail.toLowerCase(),
        role: "check_in_volunteer",
        tokenDigest: `digest-${randomUUID()}`,
        expiresAt: new Date(now.getTime() + 86_400_000),
      },
      {
        eventId: pausedEvent!.id,
        invitedByUserId: owner.id,
        normalizedEmail: suspendedEventInvite.toLowerCase(),
        role: "check_in_volunteer",
        tokenDigest: `digest-${randomUUID()}`,
        expiresAt: new Date(now.getTime() + 86_400_000),
      },
    ]);

    expect(await isEligibleStaffMagicLinkRecipient(staffEmail)).toBe(true);
    expect(await isEligibleStaffMagicLinkRecipient(inviteEmail)).toBe(true);
    expect(await isEligibleStaffMagicLinkRecipient(suspendedEmail)).toBe(false);
    expect(await isEligibleStaffMagicLinkRecipient(suspendedEventInvite)).toBe(
      false,
    );
    expect(
      await isEligibleStaffMagicLinkRecipient(`nobody-${randomUUID()}@example.com`),
    ).toBe(false);
  });
});
