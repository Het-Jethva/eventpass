import "server-only";

import { and, eq, isNull, sql, type SQL } from "drizzle-orm";

import { getTicketVerificationKeyObjects } from "@/features/tickets/server/ticket-signing-config";
import { digestBearerToken as digestInput } from "@/lib/bearer-token-digest";
import { db, type DatabaseTransaction } from "@/lib/db";
import { isUniqueViolation } from "@/lib/is-unique-violation";

import {
  auditEntry,
  checkIn,
  checkInConflict,
  event,
  eventStaff,
  registration,
  scanAttempt,
  ticket,
} from "../../../lib/db/schema";
import {
  isEventSuspended,
  lockEvent,
} from "../../events/server/event-suspension";
import { isOrganizerOrOwner } from "../../staffing/staffing-policy";
import { classifyTicketCredential } from "../../tickets/ticket-credential";
import { verifyTicket } from "../../tickets/ticket-crypto";
import type {
  AdmissionInput,
  AdmissionOutcome,
  AdmissionResult,
} from "../admission";
import { decideTicketValidity } from "../check-in-validity";

const REPLAYABLE_ONLINE_OUTCOMES = [
  "accepted",
  "duplicate",
  "conflict",
  "invalid",
  "unknown",
  "canceled",
  "replaced",
  "expired",
  "outside_window",
] as const satisfies readonly AdmissionOutcome[];

function replayedOnlineOutcome(outcome: string): AdmissionOutcome {
  for (const candidate of REPLAYABLE_ONLINE_OUTCOMES) {
    if (candidate === outcome) return candidate;
  }
  return "invalid";
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Transport validates first, but the service also guards its shape so direct
// callers cannot skip length and identity checks with expensive work.
function isWellFormedAdmissionInput(values: AdmissionInput): boolean {
  if (!UUID_PATTERN.test(values.eventId)) return false;
  if (!UUID_PATTERN.test(values.clientAttemptId)) return false;
  if (!UUID_PATTERN.test(values.actorUserId)) return false;
  const input = values.input.trim();
  if (input.length < 1 || input.length > 4096) return false;
  if (values.inputMethod !== "camera" && values.inputMethod !== "manual") {
    return false;
  }
  if (values.overrideReason !== undefined) {
    const reason = values.overrideReason.trim();
    if (reason.length < 1 || reason.length > 500) return false;
  }
  return true;
}

async function lockOnlineAttemptId(
  transaction: DatabaseTransaction,
  clientAttemptId: string,
) {
  await transaction.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`online-scan-attempt:${clientAttemptId}`}, 0))`,
  );
}

async function replayStoredOnlineAttempt(
  transaction: DatabaseTransaction,
  values: {
    clientAttemptId: string;
    eventId: string;
    actorUserId: string;
    inputDigest: string;
    inputMethod: "camera" | "manual";
  },
): Promise<AdmissionResult | null> {
  const [existing] = await transaction
    .select({
      outcome: scanAttempt.outcome,
      checkInId: scanAttempt.checkInId,
      ticketId: scanAttempt.ticketId,
      eventId: scanAttempt.eventId,
      actorUserId: scanAttempt.actorUserId,
      inputDigest: scanAttempt.inputDigest,
      inputMethod: scanAttempt.inputMethod,
    })
    .from(scanAttempt)
    .where(eq(scanAttempt.id, values.clientAttemptId))
    .limit(1);

  if (!existing) return null;
  if (
    existing.eventId !== values.eventId ||
    existing.actorUserId !== values.actorUserId ||
    existing.inputDigest !== values.inputDigest ||
    existing.inputMethod !== values.inputMethod
  ) {
    return { outcome: "invalid" };
  }

  const outcome = replayedOnlineOutcome(existing.outcome);

  let attendeeName: string | undefined;
  let checkedInAt: Date | undefined;
  if (existing.ticketId) {
    const [presented] = await transaction
      .select({ attendeeName: registration.attendeeName })
      .from(ticket)
      .innerJoin(registration, eq(registration.id, ticket.registrationId))
      .where(eq(ticket.id, existing.ticketId))
      .limit(1);
    attendeeName = presented?.attendeeName;
  }
  if (existing.checkInId) {
    const [storedCheckIn] = await transaction
      .select({ checkedInAt: checkIn.checkedInAt })
      .from(checkIn)
      .where(eq(checkIn.id, existing.checkInId))
      .limit(1);
    checkedInAt = storedCheckIn?.checkedInAt;
  } else if (
    existing.ticketId &&
    (outcome === "accepted" || outcome === "duplicate")
  ) {
    const [activeCheckIn] = await transaction
      .select({ checkedInAt: checkIn.checkedInAt })
      .from(checkIn)
      .where(
        and(
          eq(checkIn.ticketId, existing.ticketId),
          isNull(checkIn.invalidatedAt),
        ),
      )
      .limit(1);
    checkedInAt = activeCheckIn?.checkedInAt;
  }

  return {
    outcome,
    ticketId: existing.ticketId ?? undefined,
    attendeeName,
    checkInId: existing.checkInId ?? undefined,
    checkedInAt,
  };
}

export async function admitOnline({
  eventId,
  actorUserId,
  clientAttemptId,
  input,
  inputMethod,
  overrideReason,
}: AdmissionInput): Promise<AdmissionResult> {
  if (
    !isWellFormedAdmissionInput({
      eventId,
      actorUserId,
      clientAttemptId,
      input,
      inputMethod,
      overrideReason,
    })
  ) {
    return { outcome: "invalid" };
  }
  const attemptedAt = new Date();
  const credential = classifyTicketCredential(input);
  const inputDigest = digestInput(
    credential.kind === "code" ? credential.code : input,
  );
  const replayKey = {
    clientAttemptId,
    eventId,
    actorUserId,
    inputDigest,
    inputMethod,
  };

  try {
    return await db.transaction(async (transaction) => {
      await lockEvent(transaction, eventId);
      const [authorizedEvent] = await transaction
        .select({
          id: event.id,
          status: event.status,
          checkInOpensAt: event.checkInOpensAt,
          checkInClosesAt: event.checkInClosesAt,
          suspended: event.suspended,
          role: eventStaff.role,
        })
        .from(event)
        .innerJoin(
          eventStaff,
          and(
            eq(eventStaff.eventId, event.id),
            eq(eventStaff.userId, actorUserId),
          ),
        )
        .where(eq(event.id, eventId))
        .limit(1);

      if (!authorizedEvent) return { outcome: "unauthorized" };
      if (isEventSuspended(authorizedEvent)) {
        return { outcome: "event_unavailable" };
      }

      await lockOnlineAttemptId(transaction, clientAttemptId);
      const replayed = await replayStoredOnlineAttempt(transaction, replayKey);
      if (replayed) return replayed;

      const verificationKeys = getTicketVerificationKeyObjects();
      let ticketCondition: SQL | undefined;
      if (credential.kind === "code") {
        ticketCondition = and(
          eq(ticket.eventId, eventId),
          eq(ticket.code, credential.code),
        );
      } else {
        const verification = verifyTicket(credential.jws, verificationKeys);
        if (!verification.valid || verification.payload.eventId !== eventId) {
          await transaction.insert(scanAttempt).values({
            id: clientAttemptId,
            eventId,
            actorUserId,
            inputDigest,
            inputMethod,
            outcome: "invalid",
            attemptedAt,
          });
          return { outcome: "invalid" };
        }
        ticketCondition = and(
          eq(ticket.eventId, eventId),
          eq(ticket.id, verification.payload.ticketId),
        );
      }
      if (!ticketCondition) throw new Error("Could not look up the Ticket.");
      const [presentedTicket] = await transaction
        .select({
          id: ticket.id,
          status: ticket.status,
          signedPayload: ticket.signedPayload,
          attendeeName: registration.attendeeName,
          registrationStatus: registration.status,
        })
        .from(ticket)
        .innerJoin(registration, eq(registration.id, ticket.registrationId))
        .where(ticketCondition)
        .for("update")
        .limit(1);

      if (!presentedTicket) {
        await transaction.insert(scanAttempt).values({
          id: clientAttemptId,
          eventId,
          actorUserId,
          inputDigest,
          inputMethod,
          outcome: "unknown",
          attemptedAt,
        });
        return { outcome: "unknown" };
      }

      const storedTicketVerification = verifyTicket(
        presentedTicket.signedPayload,
        verificationKeys,
      );
      const storedTicketIsValid =
        storedTicketVerification.valid &&
        storedTicketVerification.payload.eventId === eventId &&
        storedTicketVerification.payload.ticketId === presentedTicket.id;

      const outsideCheckInWindow =
        attemptedAt < authorizedEvent.checkInOpensAt ||
        attemptedAt >= authorizedEvent.checkInClosesAt;
      const normalizedOverrideReason = overrideReason?.trim() ?? "";
      const canOverrideWindow =
        normalizedOverrideReason.length > 0 &&
        isOrganizerOrOwner(authorizedEvent.role);
      const decision = decideTicketValidity({
        statuses: {
          eventStatus: authorizedEvent.status,
          registrationStatus: presentedTicket.registrationStatus,
          ticketStatus: presentedTicket.status,
        },
        credentialValid: storedTicketIsValid,
        attemptedAt,
        checkInOpensAt: authorizedEvent.checkInOpensAt,
        checkInClosesAt: authorizedEvent.checkInClosesAt,
        canOverrideWindow,
      });
      const rejection = decision.verdict === "refuse" ? decision.reason : null;

      if (rejection) {
        await transaction.insert(scanAttempt).values({
          id: clientAttemptId,
          eventId,
          ticketId: presentedTicket.id,
          actorUserId,
          inputDigest,
          inputMethod,
          outcome: rejection,
          attemptedAt,
        });
        return {
          outcome: rejection,
          ticketId: presentedTicket.id,
          attendeeName: presentedTicket.attendeeName,
        };
      }

      const [unresolvedConflict] = await transaction
        .select({ id: checkInConflict.id })
        .from(checkInConflict)
        .where(
          and(
            eq(checkInConflict.ticketId, presentedTicket.id),
            eq(checkInConflict.status, "unresolved"),
          ),
        )
        .limit(1);
      if (unresolvedConflict) {
        await transaction.insert(scanAttempt).values({
          id: clientAttemptId,
          eventId,
          ticketId: presentedTicket.id,
          actorUserId,
          inputDigest,
          inputMethod,
          outcome: "conflict",
          attemptedAt,
        });
        return {
          outcome: "conflict",
          ticketId: presentedTicket.id,
          attendeeName: presentedTicket.attendeeName,
        };
      }

      const [existingCheckIn] = await transaction
        .select({ checkedInAt: checkIn.checkedInAt })
        .from(checkIn)
        .where(
          and(
            eq(checkIn.ticketId, presentedTicket.id),
            isNull(checkIn.invalidatedAt),
          ),
        )
        .limit(1);
      if (existingCheckIn) {
        await transaction.insert(scanAttempt).values({
          id: clientAttemptId,
          eventId,
          ticketId: presentedTicket.id,
          actorUserId,
          inputDigest,
          inputMethod,
          outcome: "duplicate",
          attemptedAt,
        });
        return {
          outcome: "duplicate",
          ticketId: presentedTicket.id,
          attendeeName: presentedTicket.attendeeName,
          checkedInAt: existingCheckIn.checkedInAt,
        };
      }

      const [createdCheckIn] = await transaction
        .insert(checkIn)
        .values({
          eventId,
          ticketId: presentedTicket.id,
          actorUserId,
          checkedInAt: attemptedAt,
        })
        .returning({ id: checkIn.id, checkedInAt: checkIn.checkedInAt });
      if (!createdCheckIn) throw new Error("Could not record the Check-in.");
      await transaction.insert(scanAttempt).values({
        id: clientAttemptId,
        eventId,
        ticketId: presentedTicket.id,
        checkInId: createdCheckIn.id,
        actorUserId,
        inputDigest,
        inputMethod,
        outcome: "accepted",
        attemptedAt,
      });
      if (outsideCheckInWindow) {
        await transaction.insert(auditEntry).values({
          eventId,
          actorUserId,
          action: "check_in.outside_window_override",
          targetType: "check_in",
          targetId: createdCheckIn.id,
          reason: normalizedOverrideReason,
          metadata: { ticketId: presentedTicket.id, attemptedAt },
        });
      }
      return {
        outcome: "accepted",
        ticketId: presentedTicket.id,
        attendeeName: presentedTicket.attendeeName,
        checkInId: createdCheckIn.id,
        checkedInAt: createdCheckIn.checkedInAt,
      };
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return db.transaction(async (transaction) => {
      await lockOnlineAttemptId(transaction, clientAttemptId);
      const replayed = await replayStoredOnlineAttempt(transaction, replayKey);
      if (!replayed) throw error;
      return replayed;
    });
  }
}
