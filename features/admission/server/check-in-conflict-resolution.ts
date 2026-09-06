import "server-only";

import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import {
  auditEntry,
  checkIn,
  checkInConflict,
  eventStaff,
  registration,
  scanAttempt,
  ticket,
  user,
} from "../../../lib/db/schema";
import { lockEventForMutation } from "../../events/server/event-suspension";

type ConflictResolutionDatabase = typeof import("../../../lib/db").db;

type ConflictResolutionDependencies = {
  database: ConflictResolutionDatabase;
  now?: () => Date;
};

/**
 * A Check-in Conflict resolution the caller may report verbatim.
 *
 * Conflict resolution is the one admission path that still signalled refusal
 * with a bare Error, so its callers had to widen to `instanceof Error` to say
 * anything useful — and a driver or database failure then reached an
 * Organizer's screen wearing the same clothes as "pick an attempt from this
 * conflict". Naming the domain refusals separates the two.
 */
export class CheckInConflictError extends Error {}

/**
 * Organizer review for Check-in Conflicts, beside the arbitration rule.
 * Synchronization decides conflicts automatically when it can; this module
 * owns everything after a conflict stays unresolved: listing what needs a
 * reasoned choice and recording that choice with its audit trail.
 */
export function createCheckInConflictResolutionService({
  database,
  now = () => new Date(),
}: ConflictResolutionDependencies) {
  async function listCheckInConflicts(values: {
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
    if (!assignment) return [];

    const conflicts = await database
      .select({
        id: checkInConflict.id,
        eventId: checkInConflict.eventId,
        ticketId: checkInConflict.ticketId,
        status: checkInConflict.status,
        attendeeName: registration.attendeeName,
        createdAt: checkInConflict.createdAt,
      })
      .from(checkInConflict)
      .innerJoin(ticket, eq(ticket.id, checkInConflict.ticketId))
      .innerJoin(registration, eq(registration.id, ticket.registrationId))
      .where(
        and(
          eq(checkInConflict.eventId, values.eventId),
          eq(checkInConflict.status, "unresolved"),
        ),
      )
      .orderBy(asc(checkInConflict.createdAt));

    if (conflicts.length === 0) return [];

    const attempts = await database
      .select({
        ticketId: scanAttempt.ticketId,
        id: scanAttempt.id,
        scannerDeviceId: scanAttempt.scannerDeviceId,
        actorName: user.name,
        attemptedAt: scanAttempt.attemptedAt,
        rawDeviceTime: scanAttempt.rawDeviceTime,
        timestampConfidence: scanAttempt.timestampConfidence,
      })
      .from(scanAttempt)
      .innerJoin(user, eq(user.id, scanAttempt.actorUserId))
      .where(
        and(
          inArray(
            scanAttempt.ticketId,
            conflicts.map((conflict) => conflict.ticketId),
          ),
          eq(scanAttempt.source, "offline"),
          inArray(scanAttempt.outcome, ["accepted", "conflict"]),
        ),
      )
      .orderBy(asc(scanAttempt.attemptedAt), asc(scanAttempt.id));

    const attemptsByTicket = new Map<
      string,
      Array<Omit<(typeof attempts)[number], "ticketId">>
    >();
    for (const { ticketId, ...attempt } of attempts) {
      if (!ticketId) continue;
      const groupedAttempts = attemptsByTicket.get(ticketId);
      if (groupedAttempts) {
        groupedAttempts.push(attempt);
      } else {
        attemptsByTicket.set(ticketId, [attempt]);
      }
    }

    return conflicts.map((conflict) => ({
      ...conflict,
      attempts: attemptsByTicket.get(conflict.ticketId) ?? [],
    }));
  }

  async function resolveCheckInConflict(values: {
    conflictId: string;
    actorUserId: string;
    authoritativeAttemptId: string;
    reason: string;
  }) {
    const reason = values.reason.trim();
    if (!reason) {
      throw new CheckInConflictError("A resolution reason is required.");
    }

    return database.transaction(async (transaction) => {
      const [conflict] = await transaction
        .select()
        .from(checkInConflict)
        .where(eq(checkInConflict.id, values.conflictId))
        .for("update")
        .limit(1);
      if (!conflict || conflict.status !== "unresolved") {
        throw new CheckInConflictError(
          "This Check-in Conflict is no longer unresolved.",
        );
      }
      await lockEventForMutation(transaction, conflict.eventId);
      const [assignment] = await transaction
        .select({ role: eventStaff.role })
        .from(eventStaff)
        .where(
          and(
            eq(eventStaff.eventId, conflict.eventId),
            eq(eventStaff.userId, values.actorUserId),
            inArray(eventStaff.role, ["owner", "organizer"]),
          ),
        )
        .limit(1);
      if (!assignment) {
        throw new CheckInConflictError(
          "Only an Organizer can resolve Check-in Conflicts.",
        );
      }
      const [selectedAttempt] = await transaction
        .select({
          id: scanAttempt.id,
          actorUserId: scanAttempt.actorUserId,
          attemptedAt: scanAttempt.attemptedAt,
        })
        .from(scanAttempt)
        .where(
          and(
            eq(scanAttempt.id, values.authoritativeAttemptId),
            eq(scanAttempt.eventId, conflict.eventId),
            eq(scanAttempt.ticketId, conflict.ticketId),
            eq(scanAttempt.source, "offline"),
            inArray(scanAttempt.outcome, ["accepted", "conflict"]),
          ),
        )
        .limit(1);
      if (!selectedAttempt) {
        throw new CheckInConflictError(
          "Select a Scan Attempt from this Check-in Conflict.",
        );
      }

      await transaction
        .update(checkIn)
        .set({ invalidatedAt: now() })
        .where(
          and(
            eq(checkIn.ticketId, conflict.ticketId),
            isNull(checkIn.invalidatedAt),
          ),
        );
      await transaction.insert(checkIn).values({
        eventId: conflict.eventId,
        ticketId: conflict.ticketId,
        actorUserId: selectedAttempt.actorUserId,
        checkedInAt: selectedAttempt.attemptedAt,
      });
      await transaction
        .update(checkInConflict)
        .set({
          status: "resolved_manual",
          authoritativeScanAttemptId: selectedAttempt.id,
          resolvedByUserId: values.actorUserId,
          resolutionReason: reason,
          resolvedAt: now(),
        })
        .where(eq(checkInConflict.id, conflict.id));
      await transaction.insert(auditEntry).values({
        eventId: conflict.eventId,
        actorUserId: values.actorUserId,
        action: "check_in_conflict.resolved",
        targetType: "check_in_conflict",
        targetId: conflict.id,
        reason,
        metadata: { authoritativeScanAttemptId: selectedAttempt.id },
      });
      return { eventId: conflict.eventId };
    });
  }

  return { listCheckInConflicts, resolveCheckInConflict };
}
