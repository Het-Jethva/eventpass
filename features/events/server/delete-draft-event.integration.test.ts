import { randomUUID } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";
import { expect, it } from "vitest";

import { describeWithDatabase, pointSharedDatabaseAtTestUrl } from "@/lib/test-db-helper";
import { auditEntry, event, eventStaff, staffInvitation, user } from "@/lib/db/schema";

pointSharedDatabaseAtTestUrl();

async function loadDraftDeleteModules() {
  const [deletion, staffing, database] = await Promise.all([
    import("./delete-draft-event"),
    import("@/features/staffing/server/staffing-application"),
    import("@/lib/db"),
  ]);
  return { ...deletion, ...staffing, db: database.db };
}

function uniqueEmail(prefix: string) {
  return `${prefix}-${randomUUID()}@example.com`;
}

describeWithDatabase("Draft Event deletion", () => {
  it("deletes a Draft after a Staff Invitation by clearing invitation rows and detaching Audit Entries", async () => {
    const { createStaffInvitation, deleteDraftEvent, db } =
      await loadDraftDeleteModules();
    const [owner] = await db
      .insert(user)
      .values({
        name: "Draft Owner",
        email: uniqueEmail("draft-owner"),
        emailVerified: true,
      })
      .returning({ id: user.id });
    const [createdEvent] = await db
      .insert(event)
      .values({
        name: "Draft delete test",
        description: "Exercises Staff Invitation cleanup on Draft delete.",
        slug: `draft-delete-${randomUUID()}`,
        status: "draft",
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
      })
      .returning({ id: event.id });
    await db.insert(eventStaff).values({
      eventId: createdEvent!.id,
      userId: owner!.id,
      role: "owner",
    });

    await createStaffInvitation(createdEvent!.id, owner!.id, {
      email: uniqueEmail("draft-volunteer"),
      role: "check_in_volunteer",
    });

    await deleteDraftEvent(createdEvent!.id, owner!.id);

    expect(
      await db
        .select({ id: event.id })
        .from(event)
        .where(eq(event.id, createdEvent!.id)),
    ).toEqual([]);
    expect(
      await db
        .select({ id: staffInvitation.id })
        .from(staffInvitation)
        .where(eq(staffInvitation.eventId, createdEvent!.id)),
    ).toEqual([]);
    const detached = await db
      .select({ eventId: auditEntry.eventId, action: auditEntry.action })
      .from(auditEntry)
      .where(
        and(
          isNull(auditEntry.eventId),
          eq(auditEntry.action, "staff_invitation.created"),
          eq(auditEntry.actorUserId, owner!.id),
        ),
      );
    expect(detached.length).toBeGreaterThan(0);
  });
});
