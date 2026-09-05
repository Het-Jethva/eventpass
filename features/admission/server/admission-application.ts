import "server-only";

import { createHash, type KeyObject } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import {
  auditEntry,
  checkIn,
  event,
  eventStaff,
  registration,
  scanAttempt,
  ticket,
} from "../../../lib/db/schema";
import { normalizeTicketCode } from "../../tickets/ticket-code";
import { verifyTicket } from "../../tickets/ticket-crypto";
import { isEventSuspended } from "../../events/server/event-suspension";

type AdmissionDatabase = typeof import("../../../lib/db").db;

type AdmissionApplicationDependencies = {
  database: AdmissionDatabase;
  getVerificationKeys: () => Readonly<
    Record<string, KeyObject | string | Buffer>
  >;
  now?: () => Date;
};

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

function digestInput(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

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
    const attemptedAt = now();
    const inputDigest = digestInput(input);

    return database.transaction(async (transaction) => {
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

      const code = normalizeTicketCode(input);
      const verificationKeys = getVerificationKeys();
      const verification = code ? null : verifyTicket(input, verificationKeys);
      if (
        verification &&
        (!verification.valid || verification.payload.eventId !== eventId)
      ) {
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

      const ticketCondition = code
        ? and(eq(ticket.eventId, eventId), eq(ticket.code, code))
        : and(
            eq(ticket.eventId, eventId),
            eq(ticket.id, verification!.payload.ticketId),
          );
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

      let rejection: Exclude<
        AdmissionOutcome,
        "accepted" | "duplicate" | "unknown" | "unauthorized"
      > | null = null;
      if (!storedTicketIsValid || authorizedEvent.status === "draft") {
        rejection = "invalid";
      } else if (
        authorizedEvent.status === "canceled" ||
        presentedTicket.registrationStatus === "canceled"
      ) {
        rejection = "canceled";
      } else if (presentedTicket.registrationStatus === "expired") {
        rejection = "expired";
      } else if (presentedTicket.registrationStatus !== "confirmed") {
        rejection = "invalid";
      } else if (presentedTicket.status === "canceled") {
        rejection = "canceled";
      } else if (presentedTicket.status === "replaced") {
        rejection = "replaced";
      }

      const outsideCheckInWindow =
        attemptedAt < authorizedEvent.checkInOpensAt ||
        attemptedAt >= authorizedEvent.checkInClosesAt;
      const normalizedOverrideReason = overrideReason?.trim() ?? "";
      const canOverrideWindow =
        normalizedOverrideReason.length > 0 &&
        (authorizedEvent.role === "owner" ||
          authorizedEvent.role === "organizer");
      if (
        !rejection &&
        attemptedAt >= authorizedEvent.checkInClosesAt &&
        !canOverrideWindow
      ) {
        rejection = "expired";
      } else if (
        !rejection &&
        attemptedAt < authorizedEvent.checkInOpensAt &&
        !canOverrideWindow
      ) {
        rejection = "outside_window";
      }

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
      await transaction.insert(scanAttempt).values({
        id: clientAttemptId,
        eventId,
        ticketId: presentedTicket.id,
        checkInId: createdCheckIn!.id,
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
          targetId: createdCheckIn!.id,
          reason: normalizedOverrideReason,
          metadata: { ticketId: presentedTicket.id, attemptedAt },
        });
      }
      return {
        outcome: "accepted",
        attendeeName: presentedTicket.attendeeName,
        checkInId: createdCheckIn!.id,
        checkedInAt: createdCheckIn!.checkedInAt,
      };
    });
  }

  return { admitOnline };
}
