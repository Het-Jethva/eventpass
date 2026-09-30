import "server-only";

import {
  and,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";

import {
  isPlatformAdmin,
  isSupportAccessActive,
  PlatformAdminError,
  PlatformAdminRequiredError,
  SupportAccessRequiredError,
  validateAdminReason,
} from "@/features/admin/admin-policy";
import { db, type DatabaseClient } from "@/lib/db";
import {
  auditEntry,
  event,
  registration,
  session,
  supportAccess,
  ticket,
  user,
} from "@/lib/db/schema";
import { escapeLikePattern } from "@/lib/like-pattern";
import { lockEvent } from "@/features/events/server/event-suspension";

export async function assertPlatformAdmin(
  actorUserId: string,
  transactionOrDb: DatabaseClient = db,
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
        sql`${user.name} ilike ${likePattern} escape '\\'`,
        sql`${user.email} ilike ${likePattern} escape '\\'`,
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
        sql`${event.name} ilike ${likePattern} escape '\\'`,
        sql`${event.slug} ilike ${likePattern} escape '\\'`,
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

    const [updated] = await tx
      .update(user)
      .set({ suspended: true, updatedAt: new Date() })
      .where(and(eq(user.id, targetUserId), eq(user.suspended, false)))
      .returning({ id: user.id });
    if (!updated) {
      throw new PlatformAdminError("That account is not an active staff account.");
    }

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

    const [updated] = await tx
      .update(user)
      .set({ suspended: false, updatedAt: new Date() })
      .where(and(eq(user.id, targetUserId), eq(user.suspended, true)))
      .returning({ id: user.id });
    if (!updated) {
      throw new PlatformAdminError("That account is not suspended.");
    }

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

    const [updated] = await tx
      .update(event)
      .set({
        suspended: true,
        suspendedAt: now,
        suspensionReason: validatedReason,
        updatedAt: now,
      })
      .where(and(eq(event.id, eventId), eq(event.suspended, false)))
      .returning({ id: event.id });
    if (!updated) {
      throw new PlatformAdminError("That Event is not open for suspension.");
    }

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

    const [updated] = await tx
      .update(event)
      .set({
        suspended: false,
        suspendedAt: null,
        suspensionReason: null,
        updatedAt: new Date(),
      })
      .where(and(eq(event.id, eventId), eq(event.suspended, true)))
      .returning({ id: event.id });
    if (!updated) {
      throw new PlatformAdminError("That Event is not suspended.");
    }

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
export const SUPPORT_ATTENDEE_PAGE_SIZE = 200;

export type SupportAttendeeCursor = { createdAt: string; id: string };

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
    if (!accessRecord) {
      throw new Error("Could not grant Support Access.");
    }

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
    const [located] = await tx.select({ eventId: supportAccess.eventId })
      .from(supportAccess).where(eq(supportAccess.id, supportAccessId)).limit(1);
    if (!located) {
      throw new SupportAccessRequiredError("That Support Access grant is already closed.");
    }
    await lockEvent(tx, located.eventId);

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
  cursor,
  pageSize = SUPPORT_ATTENDEE_PAGE_SIZE,
}: {
  actorUserId: string;
  eventId: string;
  now?: Date;
  cursor?: SupportAttendeeCursor | null;
  pageSize?: number;
}) {
  const limitedPageSize = Math.min(
    Math.max(1, pageSize),
    SUPPORT_ATTENDEE_PAGE_SIZE,
  );

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

    const [existingInspection] = cursor
      ? await tx
          .select({ id: auditEntry.id })
          .from(auditEntry)
          .where(
            and(
              eq(auditEntry.action, "admin.support_data_inspected"),
              eq(auditEntry.actorUserId, actorUserId),
              eq(auditEntry.eventId, eventId),
              sql`${auditEntry.metadata}->>'supportAccessId' = ${activeAccess.id}`,
            ),
          )
          .limit(1)
      : [];
    if (!cursor || !existingInspection) {
      await tx.insert(auditEntry).values({
        actorUserId,
        eventId,
        action: "admin.support_data_inspected",
        targetType: "event",
        targetId: eventId,
        reason: activeAccess.reason,
        metadata: { supportAccessId: activeAccess.id },
      });
    }

    const [targetEvent] = await tx
      .select({ id: event.id, name: event.name, slug: event.slug })
      .from(event)
      .where(eq(event.id, eventId))
      .limit(1);

    const eventFilter = eq(registration.eventId, eventId);
    // Cursor text is cast back to timestamptz so microseconds still match.
    const pageFilter = cursor
      ? and(
          eventFilter,
          or(
            sql`${registration.createdAt} < ${cursor.createdAt}::timestamptz`,
            and(
              sql`${registration.createdAt} = ${cursor.createdAt}::timestamptz`,
              lt(registration.id, cursor.id),
            ),
          ),
        )
      : eventFilter;

    const pageRows = await tx
      .select({
        id: registration.id,
        attendeeName: registration.attendeeName,
        attendeeEmail: registration.email,
        status: registration.status,
        createdAt: registration.createdAt,
        createdAtText: sql<string>`to_char(${registration.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`.mapWith(
          String,
        ),
      })
      .from(registration)
      .where(pageFilter)
      .orderBy(desc(registration.createdAt), desc(registration.id))
      .limit(limitedPageSize + 1);

    const hasMore = pageRows.length > limitedPageSize;
    const visibleRows = hasMore ? pageRows.slice(0, limitedPageSize) : pageRows;
    const lastRow = visibleRows.at(-1);
    const registrationIds = visibleRows.map((row) => row.id);

    const ticketRows =
      registrationIds.length === 0
        ? []
        : await tx
            .select({
              id: ticket.id,
              registrationId: ticket.registrationId,
              code: ticket.code,
              status: ticket.status,
            })
            .from(ticket)
            .where(
              and(
                inArray(ticket.registrationId, registrationIds),
                eq(ticket.status, "active"),
              ),
            );

    const ticketByRegistration = new Map(
      ticketRows.map((row) => [row.registrationId, row]),
    );

    const registrations = visibleRows.map((row) => {
      const activeTicket = ticketByRegistration.get(row.id);
      return {
        id: row.id,
        attendeeName: row.attendeeName,
        attendeeEmail: row.attendeeEmail,
        status: row.status,
        createdAt: row.createdAt,
        ticketId: activeTicket?.id ?? null,
        ticketCode: activeTicket?.code ?? null,
        ticketStatus: activeTicket?.status ?? null,
      };
    });

    return {
      event: targetEvent,
      activeSupportAccess: activeAccess,
      registrations,
      nextCursor:
        hasMore && lastRow
          ? { createdAt: lastRow.createdAtText, id: lastRow.id }
          : null,
    };
  });
}
