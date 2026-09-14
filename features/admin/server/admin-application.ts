import "server-only";

import { and, desc, eq, gt, ilike, isNull, or } from "drizzle-orm";

import {
  isPlatformAdmin,
  isSupportAccessActive,
  PlatformAdminError,
  PlatformAdminRequiredError,
  SupportAccessRequiredError,
  validateAdminReason,
} from "@/features/admin/admin-policy";
import { db } from "@/lib/db";
import {
  auditEntry,
  event,
  registration,
  session,
  supportAccess,
  ticket,
  user,
} from "@/lib/db/schema";

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export async function assertPlatformAdmin(
  actorUserId: string,
  transactionOrDb: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0] = db,
) {
  const [actor] = await transactionOrDb
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      suspended: user.suspended,
      isPlatformAdmin: user.isPlatformAdmin,
    })
    .from(user)
    .where(eq(user.id, actorUserId))
    .limit(1);

  if (!actor || actor.suspended) {
    throw new PlatformAdminRequiredError();
  }

  const isAdmin = isPlatformAdmin({
    userEmail: actor.email,
    isPlatformAdminFlag: actor.isPlatformAdmin,
  });

  if (!isAdmin) {
    throw new PlatformAdminRequiredError();
  }

  return actor;
}

export async function listPlatformAccounts({
  actorUserId,
  search,
}: {
  actorUserId: string;
  search?: string;
}) {
  await assertPlatformAdmin(actorUserId);

  const trimmedSearch = search?.trim();
  const likePattern = trimmedSearch
    ? `%${escapeLikePattern(trimmedSearch)}%`
    : null;
  const searchFilter = likePattern
    ? or(
        ilike(user.name, likePattern),
        ilike(user.email, likePattern),
      )
    : undefined;

  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      suspended: user.suspended,
      isPlatformAdmin: user.isPlatformAdmin,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(searchFilter)
    .orderBy(desc(user.createdAt))
    .limit(100);
}

export async function listPlatformEvents({
  actorUserId,
  search,
}: {
  actorUserId: string;
  search?: string;
}) {
  await assertPlatformAdmin(actorUserId);

  const trimmedSearch = search?.trim();
  const likePattern = trimmedSearch
    ? `%${escapeLikePattern(trimmedSearch)}%`
    : null;
  const searchFilter = likePattern
    ? or(
        ilike(event.name, likePattern),
        ilike(event.slug, likePattern),
      )
    : undefined;

  return db
    .select({
      id: event.id,
      name: event.name,
      slug: event.slug,
      status: event.status,
      capacity: event.capacity,
      suspended: event.suspended,
      suspendedAt: event.suspendedAt,
      suspensionReason: event.suspensionReason,
      startsAt: event.startsAt,
      createdAt: event.createdAt,
    })
    .from(event)
    .where(searchFilter)
    .orderBy(desc(event.createdAt))
    .limit(100);
}

export async function suspendStaffAccount({
  actorUserId,
  targetUserId,
  reason,
}: {
  actorUserId: string;
  targetUserId: string;
  reason: string;
}) {
  const validatedReason = validateAdminReason(reason);
  if (actorUserId === targetUserId) {
    throw new PlatformAdminError("You cannot suspend your own account.");
  }

  return db.transaction(async (tx) => {
    await assertPlatformAdmin(actorUserId, tx);

    await tx
      .update(user)
      .set({ suspended: true, updatedAt: new Date() })
      .where(eq(user.id, targetUserId));

    // Flagging the account is not enough on its own: Better Auth database
    // sessions stay valid until they expire, so a suspended staff member
    // keeps acting on every path that reads the session directly. Drop
    // their sessions here so suspension takes effect immediately.
    await tx.delete(session).where(eq(session.userId, targetUserId));

    await tx.insert(auditEntry).values({
      actorUserId,
      action: "admin.account_suspended",
      targetType: "user",
      targetId: targetUserId,
      reason: validatedReason,
      metadata: {},
    });
  });
}

export async function reactivateStaffAccount({
  actorUserId,
  targetUserId,
  reason,
}: {
  actorUserId: string;
  targetUserId: string;
  reason: string;
}) {
  const validatedReason = validateAdminReason(reason);

  return db.transaction(async (tx) => {
    await assertPlatformAdmin(actorUserId, tx);

    await tx
      .update(user)
      .set({ suspended: false, updatedAt: new Date() })
      .where(eq(user.id, targetUserId));

    await tx.insert(auditEntry).values({
      actorUserId,
      action: "admin.account_reactivated",
      targetType: "user",
      targetId: targetUserId,
      reason: validatedReason,
      metadata: {},
    });
  });
}

export async function suspendEvent({
  actorUserId,
  eventId,
  reason,
  now = new Date(),
}: {
  actorUserId: string;
  eventId: string;
  reason: string;
  now?: Date;
}) {
  const validatedReason = validateAdminReason(reason);

  return db.transaction(async (tx) => {
    await assertPlatformAdmin(actorUserId, tx);

    await tx
      .update(event)
      .set({
        suspended: true,
        suspendedAt: now,
        suspensionReason: validatedReason,
        updatedAt: now,
      })
      .where(eq(event.id, eventId));

    await tx.insert(auditEntry).values({
      actorUserId,
      eventId,
      action: "admin.event_suspended",
      targetType: "event",
      targetId: eventId,
      reason: validatedReason,
      metadata: {},
    });
  });
}

export async function reactivateEvent({
  actorUserId,
  eventId,
  reason,
}: {
  actorUserId: string;
  eventId: string;
  reason: string;
}) {
  const validatedReason = validateAdminReason(reason);

  return db.transaction(async (tx) => {
    await assertPlatformAdmin(actorUserId, tx);

    await tx
      .update(event)
      .set({
        suspended: false,
        suspendedAt: null,
        suspensionReason: null,
        updatedAt: new Date(),
      })
      .where(eq(event.id, eventId));

    await tx.insert(auditEntry).values({
      actorUserId,
      eventId,
      action: "admin.event_reactivated",
      targetType: "event",
      targetId: eventId,
      reason: validatedReason,
      metadata: {},
    });
  });
}

export const DEFAULT_SUPPORT_ACCESS_DURATION_MINUTES = 60;
export const MAX_SUPPORT_ACCESS_DURATION_MINUTES = 480;

export async function grantSupportAccess({
  actorUserId,
  eventId,
  reason,
  durationMinutes = DEFAULT_SUPPORT_ACCESS_DURATION_MINUTES,
  now = new Date(),
}: {
  actorUserId: string;
  eventId: string;
  reason: string;
  durationMinutes?: number;
  now?: Date;
}) {
  const validatedReason = validateAdminReason(reason);
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 1 ||
    durationMinutes > MAX_SUPPORT_ACCESS_DURATION_MINUTES
  ) {
    throw new PlatformAdminError(
      `Support Access lasts between 1 and ${MAX_SUPPORT_ACCESS_DURATION_MINUTES} minutes.`,
    );
  }
  const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1_000);

  return db.transaction(async (tx) => {
    await assertPlatformAdmin(actorUserId, tx);

    const [targetEvent] = await tx
      .select({ id: event.id })
      .from(event)
      .where(eq(event.id, eventId))
      .limit(1);
    if (!targetEvent) {
      throw new PlatformAdminError("That Event does not exist.");
    }

    const [accessRecord] = await tx
      .insert(supportAccess)
      .values({
        eventId,
        adminUserId: actorUserId,
        reason: validatedReason,
        expiresAt,
        createdAt: now,
      })
      .returning();

    await tx.insert(auditEntry).values({
      actorUserId,
      eventId,
      action: "admin.support_access_granted",
      targetType: "event",
      targetId: eventId,
      reason: validatedReason,
      metadata: { expiresAt: expiresAt.toISOString() },
    });

    return accessRecord;
  });
}

export async function revokeSupportAccess({
  actorUserId,
  supportAccessId,
  reason,
  now = new Date(),
}: {
  actorUserId: string;
  supportAccessId: string;
  reason: string;
  now?: Date;
}) {
  const validatedReason = validateAdminReason(reason);

  return db.transaction(async (tx) => {
    await assertPlatformAdmin(actorUserId, tx);

    const [activeAccess] = await tx
      .select()
      .from(supportAccess)
      .where(
        and(
          eq(supportAccess.id, supportAccessId),
          isNull(supportAccess.revokedAt),
          gt(supportAccess.expiresAt, now),
        ),
      )
      .for("update")
      .limit(1);
    if (!activeAccess) {
      throw new SupportAccessRequiredError(
        "That Support Access grant is already closed.",
      );
    }

    await tx
      .update(supportAccess)
      .set({ revokedAt: now })
      .where(eq(supportAccess.id, activeAccess.id));

    await tx.insert(auditEntry).values({
      actorUserId,
      eventId: activeAccess.eventId,
      action: "admin.support_access_revoked",
      targetType: "support_access",
      targetId: activeAccess.id,
      reason: validatedReason,
      metadata: {},
    });

    return { eventId: activeAccess.eventId };
  });
}

export async function getEventAttendeeDataForSupport({
  actorUserId,
  eventId,
  now = new Date(),
}: {
  actorUserId: string;
  eventId: string;
  now?: Date;
}) {
  return db.transaction(async (tx) => {
    await assertPlatformAdmin(actorUserId, tx);

    const [activeAccess] = await tx
      .select()
      .from(supportAccess)
      .where(
        and(
          eq(supportAccess.eventId, eventId),
          eq(supportAccess.adminUserId, actorUserId),
          isNull(supportAccess.revokedAt),
          gt(supportAccess.expiresAt, now),
        ),
      )
      .orderBy(desc(supportAccess.expiresAt))
      .limit(1);

    if (!activeAccess || !isSupportAccessActive({ expiresAt: activeAccess.expiresAt, revokedAt: activeAccess.revokedAt, now })) {
      throw new SupportAccessRequiredError();
    }

    await tx.insert(auditEntry).values({
      actorUserId,
      eventId,
      action: "admin.support_data_inspected",
      targetType: "event",
      targetId: eventId,
      reason: activeAccess.reason,
      metadata: { supportAccessId: activeAccess.id },
    });

    const [targetEvent] = await tx
      .select({ id: event.id, name: event.name, slug: event.slug })
      .from(event)
      .where(eq(event.id, eventId))
      .limit(1);

    const registrations = await tx
      .select({
        id: registration.id,
        attendeeName: registration.attendeeName,
        attendeeEmail: registration.email,
        status: registration.status,
        createdAt: registration.createdAt,
        ticketId: ticket.id,
        ticketCode: ticket.code,
        ticketStatus: ticket.status,
      })
      .from(registration)
      .leftJoin(ticket, eq(ticket.registrationId, registration.id))
      .where(eq(registration.eventId, eventId))
      .orderBy(desc(registration.createdAt))
      .limit(200);

    return {
      event: targetEvent,
      activeSupportAccess: activeAccess,
      registrations,
    };
  });
}
