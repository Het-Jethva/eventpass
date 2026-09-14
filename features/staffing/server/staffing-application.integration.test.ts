import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { expect, it } from "vitest";

import { describeWithDatabase, pointSharedDatabaseAtTestUrl } from "@/lib/test-db-helper";
import {
  event,
  eventStaff,
  ownershipTransfer,
  staffInvitation,
  user,
} from "@/lib/db/schema";
import { digestTokenBase64Url } from "@/lib/bearer-token-digest";

pointSharedDatabaseAtTestUrl();

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

    const transfer = await proposeOwnershipTransfer(
      createdEvent!.id,
      organizer.id,
      owner.id,
    );

    await expect(
      withdrawOwnershipTransfer(transfer.id, organizer.id),
    ).rejects.toThrow(StaffingAuthorizationError);

    await withdrawOwnershipTransfer(transfer.id, owner.id);

    const [withdrawn] = await db
      .select({ revokedAt: ownershipTransfer.revokedAt })
      .from(ownershipTransfer)
      .where(eq(ownershipTransfer.id, transfer.id));
    expect(withdrawn?.revokedAt).toBeInstanceOf(Date);

    await expect(
      acceptOwnershipTransfer(transfer.id, organizer.id),
    ).rejects.toThrow(OwnershipTransferUnavailableError);
    await expect(
      withdrawOwnershipTransfer(transfer.id, owner.id),
    ).rejects.toThrow(OwnershipTransferUnavailableError);

    const second = await proposeOwnershipTransfer(
      createdEvent!.id,
      organizer.id,
      owner.id,
    );
    expect(second.id).not.toBe(transfer.id);
  });

  it("stores a Staff Invitation digest, accepts the matching token, and rejects the rest", async () => {
    const {
      createStaffInvitation,
      acceptStaffInvitation,
      inspectStaffInvitation,
      StaffingAuthorizationError,
      StaffInvitationUnavailableError,
      StaffInvitationEmailMismatchError,
      db,
    } = await loadStaffingApplication();

    const volunteerEmail = uniqueEmail("invite-volunteer");
    const [owner, volunteer, other] = await Promise.all([
      db
        .insert(user)
        .values({
          name: "Invite Owner",
          email: uniqueEmail("invite-owner"),
          emailVerified: true,
        })
        .returning({ id: user.id })
        .then((rows) => rows[0]!),
      db
        .insert(user)
        .values({
          name: "Invite Volunteer",
          email: volunteerEmail,
          emailVerified: true,
        })
        .returning({ id: user.id })
        .then((rows) => rows[0]!),
      db
        .insert(user)
        .values({
          name: "Wrong Inbox",
          email: uniqueEmail("invite-other"),
          emailVerified: true,
        })
        .returning({ id: user.id })
        .then((rows) => rows[0]!),
    ]);
    const [createdEvent] = await db
      .insert(event)
      .values({
        name: "Invitation digest test",
        description: "Exercises Staff Invitation token lookup.",
        slug: `invite-digest-${randomUUID()}`,
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
    await db.insert(eventStaff).values({
      eventId: createdEvent!.id,
      userId: owner.id,
      role: "owner",
    });

    const invitation = await createStaffInvitation(createdEvent!.id, owner.id, {
      email: volunteerEmail,
      role: "check_in_volunteer",
    });
    const [stored] = await db
      .select({ tokenDigest: staffInvitation.tokenDigest })
      .from(staffInvitation)
      .where(eq(staffInvitation.eventId, createdEvent!.id));
    expect(stored?.tokenDigest).toBe(digestTokenBase64Url(invitation.token));
    expect(await inspectStaffInvitation("not-the-token")).toBeNull();
    expect(await inspectStaffInvitation(invitation.token)).toMatchObject({
      role: "check_in_volunteer",
      normalizedEmail: volunteerEmail.toLowerCase(),
    });

    await expect(
      acceptStaffInvitation(invitation.token, other.id),
    ).rejects.toThrow(StaffInvitationEmailMismatchError);

    await acceptStaffInvitation(invitation.token, volunteer.id);
    await expect(
      acceptStaffInvitation(invitation.token, volunteer.id),
    ).rejects.toThrow(StaffInvitationUnavailableError);

    await expect(
      createStaffInvitation(createdEvent!.id, volunteer.id, {
        email: uniqueEmail("blocked-organizer"),
        role: "organizer",
      }),
    ).rejects.toThrow(StaffingAuthorizationError);
  });
});
