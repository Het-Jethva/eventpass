import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import {
  auditEntry,
  checkIn,
  checkInReversal,
  eventStaff,
  registration,
  ticket,
  user,
} from "../../../lib/db/schema";

const QUICK_REVERSAL_WINDOW_MS = 30_000;
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

  async function listActiveCheckIns(values: {
    eventId: string;
    actorUserId: string;
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

    return database
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
    .where(
      and(
        eq(checkIn.eventId, values.eventId),
        isNull(checkIn.invalidatedAt),
      ),
    )
      .orderBy(desc(checkIn.checkedInAt));
  }

  return { listActiveCheckIns, reverseCheckIn };
}
