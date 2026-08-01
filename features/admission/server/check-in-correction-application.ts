import { and, count, desc, eq, ilike, inArray, isNull } from "drizzle-orm";

import {
  auditEntry,
  checkIn,
  checkInReversal,
  eventStaff,
  registration,
  ticket,
  user,
} from "../../../lib/db/schema";
import { lockEventForMutation } from "../../events/server/event-suspension";

const QUICK_REVERSAL_WINDOW_MS = 30_000;
export const ACTIVE_CHECK_IN_PAGE_SIZE = 25;
type CorrectionDatabase = typeof import("../../../lib/db").db;

export class CheckInCorrectionError extends Error {}

export function createCheckInCorrectionService({
  database,
  now = () => new Date(),
}: {
  database: CorrectionDatabase;
  now?: () => Date;
}) {
  async function reverseCheckIn(values: {
    eventId: string;
    checkInId: string;
    actorUserId: string;
    reason: string;
  }) {
    const reversedAt = now();
    const reason = values.reason.trim();
    if (!reason) {
      throw new CheckInCorrectionError("Provide a reason for this reversal.");
    }

    return database.transaction(async (transaction) => {
    await lockEventForMutation(transaction, values.eventId);
    const [target] = await transaction
      .select({
        id: checkIn.id,
        eventId: checkIn.eventId,
        ticketId: checkIn.ticketId,
        checkedInAt: checkIn.checkedInAt,
        invalidatedAt: checkIn.invalidatedAt,
      })
      .from(checkIn)
      .where(
        and(
          eq(checkIn.id, values.checkInId),
          eq(checkIn.eventId, values.eventId),
        ),
      )
      .limit(1);
    if (!target) {
      throw new CheckInCorrectionError("That Check-in could not be found.");
    }

    await transaction
      .select({ id: ticket.id })
      .from(ticket)
      .where(eq(ticket.id, target.ticketId))
      .for("update");

    const [lockedTarget] = await transaction
      .select({
        invalidatedAt: checkIn.invalidatedAt,
        actorUserId: checkIn.actorUserId,
        checkedInAt: checkIn.checkedInAt,
      })
      .from(checkIn)
      .where(eq(checkIn.id, target.id))
      .for("update")
      .limit(1);
    if (!lockedTarget || lockedTarget.invalidatedAt) {
      throw new CheckInCorrectionError("That Check-in is no longer active.");
    }

    const [assignment] = await transaction
      .select({ role: eventStaff.role })
      .from(eventStaff)
      .where(
        and(
          eq(eventStaff.eventId, target.eventId),
          eq(eventStaff.userId, values.actorUserId),
        ),
      )
      .limit(1);
    if (!assignment) {
      throw new CheckInCorrectionError(
        "Your current staff access does not allow this correction.",
      );
    }

    const organizer =
      assignment.role === "owner" || assignment.role === "organizer";
    let kind: "quick" | "organizer";
    if (organizer) {
      kind = "organizer";
    } else {
      const [mostRecent] = await transaction
        .select({ id: checkIn.id })
        .from(checkIn)
        .where(
          and(
            eq(checkIn.eventId, target.eventId),
            eq(checkIn.actorUserId, values.actorUserId),
          ),
        )
        .orderBy(desc(checkIn.checkedInAt), desc(checkIn.id))
        .limit(1);
      const elapsed = reversedAt.getTime() - lockedTarget.checkedInAt.getTime();
      if (
        lockedTarget.actorUserId !== values.actorUserId ||
        mostRecent?.id !== target.id ||
        elapsed < 0 ||
        elapsed > QUICK_REVERSAL_WINDOW_MS
      ) {
        throw new CheckInCorrectionError(
          "Quick Reversal is limited to your own most recent Check-in within 30 seconds.",
        );
      }
      kind = "quick";
    }

    const [reversal] = await transaction
      .insert(checkInReversal)
      .values({
        eventId: target.eventId,
        checkInId: target.id,
        actorUserId: values.actorUserId,
        kind,
        reason,
        createdAt: reversedAt,
      })
      .returning({ id: checkInReversal.id });
    await transaction
      .update(checkIn)
      .set({ invalidatedAt: reversedAt })
      .where(and(eq(checkIn.id, target.id), isNull(checkIn.invalidatedAt)));
    await transaction.insert(auditEntry).values({
      eventId: target.eventId,
      actorUserId: values.actorUserId,
      action: "check_in.reversed",
      targetType: "check_in",
      targetId: target.id,
      reason,
      metadata: { reversalId: reversal!.id, kind, ticketId: target.ticketId },
    });

      return { outcome: "reversed" as const, kind };
    });
  }

  /**
   * The most recent active Check-ins, optionally narrowed by attendee name.
   *
   * Previously returned every active Check-in with no bound and no search, so a
   * 500-person Event rendered 500 rows the Organizer had to scroll to find one
   * person in. The list exists to correct a specific Check-in, so it is capped
   * and searchable in the database and reports the true total.
   */
  async function listActiveCheckIns(values: {
    eventId: string;
    actorUserId: string;
    searchQuery?: string;
    limit?: number;
  }) {
    const [assignment] = await database
      .select({ role: eventStaff.role })
      .from(eventStaff)
      .where(
        and(
          eq(eventStaff.eventId, values.eventId),
          eq(eventStaff.userId, values.actorUserId),
          inArray(eventStaff.role, ["owner", "organizer"]),
        ),
      )
      .limit(1);
    if (!assignment) {
      throw new CheckInCorrectionError(
        "Only an Organizer can review active Check-ins.",
      );
    }

    const trimmedQuery = values.searchQuery?.trim() ?? "";
    const limit = values.limit ?? ACTIVE_CHECK_IN_PAGE_SIZE;

    const scope = and(
      eq(checkIn.eventId, values.eventId),
      isNull(checkIn.invalidatedAt),
    );
    const matchCondition = trimmedQuery
      ? and(scope, ilike(registration.attendeeName, `%${trimmedQuery}%`))
      : scope;

    const [rows, [matching], [total]] = await Promise.all([
      database
        .select({
          id: checkIn.id,
          attendeeName: registration.attendeeName,
          checkedInAt: checkIn.checkedInAt,
          actorName: user.name,
        })
        .from(checkIn)
        .innerJoin(ticket, eq(ticket.id, checkIn.ticketId))
        .innerJoin(registration, eq(registration.id, ticket.registrationId))
        .innerJoin(user, eq(user.id, checkIn.actorUserId))
        .where(matchCondition)
        .orderBy(desc(checkIn.checkedInAt))
        .limit(limit),
      database
        .select({ value: count() })
        .from(checkIn)
        .innerJoin(ticket, eq(ticket.id, checkIn.ticketId))
        .innerJoin(registration, eq(registration.id, ticket.registrationId))
        .where(matchCondition)
        .then((result) => result),
      database
        .select({ value: count() })
        .from(checkIn)
        .where(scope)
        .then((result) => result),
    ]);

    return {
      rows,
      matchingCount: matching?.value ?? 0,
      totalCount: total?.value ?? 0,
      limit,
    };
  }

  return { listActiveCheckIns, reverseCheckIn };
}
