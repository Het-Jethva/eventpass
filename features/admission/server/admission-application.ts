import "server-only";

import type { DatabaseClient } from "@/lib/db";

import type { KeyObject } from "node:crypto";

import { and, eq, isNull, sql, type SQL } from "drizzle-orm";

import {
  auditEntry,
  checkIn,
  event,
  eventStaff,
  registration,
  scanAttempt,
  ticket,
} from "../../../lib/db/schema";
import { classifyTicketCredential } from "../../tickets/ticket-credential";
import { digestBearerToken as digestInput } from "@/lib/bearer-token-digest";
import { isUniqueViolation } from "@/lib/is-unique-violation";
import { verifyTicket } from "../../tickets/ticket-crypto";
import { isEventSuspended } from "../../events/server/event-suspension";
import { isOrganizerOrOwner } from "../../staffing/staffing-policy";
import { decideTicketValidity } from "../check-in-validity";

type AdmissionDatabase = DatabaseClient;
type AdmissionTransaction = Parameters<
  Parameters<AdmissionDatabase["transaction"]>[0]
>[0];

export type AdmissionOutcome =
  | "accepted"
  | "provisional"
  | "duplicate"
  | "invalid"
  | "unknown"
  | "canceled"
  | "replaced"
  | "expired"
  | "outside_window"
  | "event_unavailable"
  | "unauthorized";

export type AdmissionResult = {
  outcome: AdmissionOutcome;
  attendeeName?: string;
  checkedInAt?: Date;
  checkInId?: string;
};

export type AdmissionInput = {
  eventId: string;
  actorUserId: string;
  clientAttemptId: string;
  input: string;
  inputMethod: "camera" | "manual";
  overrideReason?: string;
};

const REPLAYABLE_ONLINE_OUTCOMES = [
  "accepted",
  "duplicate",
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
  transaction: AdmissionTransaction,
  clientAttemptId: string,
) {
  await transaction.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`online-scan-attempt:${clientAttemptId}`}, 0))`,
  );
}

async function replayStoredOnlineAttempt(
  transaction: AdmissionTransaction,
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
  } else if (existing.ticketId && (outcome === "accepted" || outcome === "duplicate")) {
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
    attendeeName,
    checkInId: existing.checkInId ?? undefined,
    checkedInAt,
  };
}

type AdmissionApplicationDependencies = {
  database: AdmissionDatabase;
  getVerificationKeys: () => Readonly<
    Record<string, KeyObject | string | Buffer>
  >;
  now?: () => Date;
};

export function createAdmissionApplicationService({
  database,
  getVerificationKeys,
  now = () => new Date(),
}: AdmissionApplicationDependencies) {
  async function admitOnline({
    eventId,
    actorUserId,
    clientAttemptId,
    input,
    inputMethod,
    overrideReason,
  }: AdmissionInput): Promise<AdmissionResult> {
    if (!isWellFormedAdmissionInput({ eventId, actorUserId, clientAttemptId, input, inputMethod, overrideReason })) {
      return { outcome: "invalid" };
    }
    const attemptedAt = now();
    const inputDigest = digestInput(input);
    const replayKey = {
      clientAttemptId,
      eventId,
      actorUserId,
      inputDigest,
      inputMethod,
    };

    try {
      return await database.transaction(async (transaction) => {
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

      const credential = classifyTicketCredential(input);
      const verificationKeys = getVerificationKeys();
      let ticketCondition: SQL | undefined;
      if (credential.kind === "code") {
        ticketCondition = and(eq(ticket.eventId, eventId), eq(ticket.code, credential.code));
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
      const rejection =
        decision.verdict === "refuse" ? decision.reason : null;

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
        attendeeName: presentedTicket.attendeeName,
        checkInId: createdCheckIn.id,
        checkedInAt: createdCheckIn.checkedInAt,
      };
    });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      return database.transaction(async (transaction) => {
        await lockOnlineAttemptId(transaction, clientAttemptId);
        const replayed = await replayStoredOnlineAttempt(transaction, replayKey);
        if (!replayed) throw error;
        return replayed;
      });
    }
  }

  return { admitOnline };
}
