import type { KeyObject } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import {
  checkIn,
  event,
  registration,
  scanAttempt,
  ticket,
} from "../../../lib/db/schema";
import { verifyTicket } from "../../tickets/ticket-crypto";
import { verifyScannerAuthorization } from "../scanner-authorization";

type SynchronizationDatabase = typeof import("../../../lib/db").db;

export type OfflineScanAttemptInput = {
  id: string;
  eventId: string;
  ticketId: string | null;
  inputDigest: string;
  inputMethod: "camera" | "manual";
  capturedOutcome:
    | "provisional"
    | "duplicate"
    | "invalid"
    | "unknown"
    | "canceled"
    | "replaced"
    | "expired"
    | "outside_window";
  deviceRecordedAt: string;
  serverTimeAnchor: string;
  monotonicElapsedMs: number;
  timestampConfidence: "high" | "low";
  signedTicket: string | null;
  scannerDeviceId: string;
};

export type OfflineSynchronizationResult = {
  id: string;
  ticketId: string | null;
  outcome:
    | "accepted"
    | "duplicate"
    | "invalid"
    | "unknown"
    | "canceled"
    | "replaced"
    | "expired"
    | "outside_window";
  changed: boolean;
};

type SynchronizationDependencies = {
  database: SynchronizationDatabase;
  getVerificationKeys: () => Readonly<
    Record<string, KeyObject | string | Buffer>
  >;
  now?: () => Date;
};

type StoredOutcome = OfflineSynchronizationResult["outcome"];

export function createOfflineSynchronizationService({
  database,
  getVerificationKeys,
  now = () => new Date(),
}: SynchronizationDependencies) {
  async function synchronizeOfflineAttempts(values: {
    authorization: string;
    attempts: OfflineScanAttemptInput[];
  }): Promise<
    | { outcome: "unauthorized"; results: [] }
    | { outcome: "acknowledged"; results: OfflineSynchronizationResult[] }
  > {
    const verificationKeys = getVerificationKeys();
    const authorization = verifyScannerAuthorization(
      values.authorization,
      verificationKeys,
    );
    if (!authorization.valid) {
      return { outcome: "unauthorized", results: [] };
    }

    const payload = authorization.payload;
    const results: OfflineSynchronizationResult[] = [];
    for (const attempt of values.attempts) {
      if (
        attempt.eventId !== payload.eventId ||
        attempt.scannerDeviceId !== payload.scannerDeviceId ||
        attempt.serverTimeAnchor !== payload.issuedAt
      ) {
        return { outcome: "unauthorized", results: [] };
      }

      const result = await database.transaction(async (transaction) => {
        const [existing] = await transaction
          .select({
            id: scanAttempt.id,
            ticketId: scanAttempt.ticketId,
            outcome: scanAttempt.outcome,
          })
          .from(scanAttempt)
          .where(eq(scanAttempt.id, attempt.id))
          .limit(1);
        if (existing) {
          return {
            id: existing.id,
            ticketId: existing.ticketId,
            outcome: existing.outcome as StoredOutcome,
            changed: existing.outcome !== attempt.capturedOutcome,
          };
        }

        const attemptedAt = new Date(
          new Date(attempt.serverTimeAnchor).getTime() +
            attempt.monotonicElapsedMs,
        );
        const rawDeviceTime = new Date(attempt.deviceRecordedAt);
        const authorizationExpired =
          attemptedAt > new Date(payload.expiresAt) ||
          attemptedAt > new Date(now().getTime() + 5 * 60 * 1000);
        const ticketVerification = attempt.signedTicket
          ? verifyTicket(attempt.signedTicket, verificationKeys)
          : null;
        const signedTicketIsValid =
          ticketVerification?.valid === true &&
          ticketVerification.payload.eventId === attempt.eventId &&
          ticketVerification.payload.ticketId === attempt.ticketId;

        let presentedTicket:
          | {
              id: string;
              status: string;
              registrationStatus: string;
              eventStatus: string;
              checkInOpensAt: Date;
              checkInClosesAt: Date;
            }
          | undefined;
        if (attempt.ticketId) {
          [presentedTicket] = await transaction
            .select({
              id: ticket.id,
              status: ticket.status,
              registrationStatus: registration.status,
              eventStatus: event.status,
              checkInOpensAt: event.checkInOpensAt,
              checkInClosesAt: event.checkInClosesAt,
            })
            .from(ticket)
            .innerJoin(registration, eq(registration.id, ticket.registrationId))
            .innerJoin(event, eq(event.id, ticket.eventId))
            .where(
              and(
                eq(ticket.id, attempt.ticketId),
                eq(ticket.eventId, attempt.eventId),
              ),
            )
            .for("update")
            .limit(1);
        }

        let outcome: StoredOutcome;
        if (
          attempt.capturedOutcome === "invalid" ||
          attempt.capturedOutcome === "unknown"
        ) {
          outcome = attempt.capturedOutcome;
        } else if (
          authorizationExpired ||
          !signedTicketIsValid ||
          !presentedTicket
        ) {
          outcome = !presentedTicket ? "unknown" : "invalid";
        } else if (
          presentedTicket.eventStatus === "canceled" ||
          presentedTicket.registrationStatus === "canceled" ||
          presentedTicket.status === "canceled"
        ) {
          outcome = "canceled";
        } else if (presentedTicket.status === "replaced") {
          outcome = "replaced";
        } else if (presentedTicket.registrationStatus === "expired") {
          outcome = "expired";
        } else if (
          presentedTicket.registrationStatus !== "confirmed" ||
          presentedTicket.eventStatus !== "published"
        ) {
          outcome = "invalid";
        } else if (attemptedAt >= presentedTicket.checkInClosesAt) {
          outcome = "expired";
        } else if (attemptedAt < presentedTicket.checkInOpensAt) {
          outcome = "outside_window";
        } else if (attempt.capturedOutcome !== "provisional") {
          outcome = attempt.capturedOutcome;
        } else {
          const [existingCheckIn] = await transaction
            .select({ id: checkIn.id })
            .from(checkIn)
            .where(
              and(
                eq(checkIn.ticketId, presentedTicket.id),
                isNull(checkIn.invalidatedAt),
              ),
            )
            .limit(1);
          if (existingCheckIn) {
            outcome = "duplicate";
          } else {
            const [createdCheckIn] = await transaction
              .insert(checkIn)
              .values({
                eventId: attempt.eventId,
                ticketId: presentedTicket.id,
                actorUserId: payload.volunteerUserId,
                checkedInAt: attemptedAt,
              })
              .returning({ id: checkIn.id });
            await transaction.insert(scanAttempt).values({
              id: attempt.id,
              eventId: attempt.eventId,
              ticketId: presentedTicket.id,
              checkInId: createdCheckIn!.id,
              actorUserId: payload.volunteerUserId,
              scannerDeviceId: attempt.scannerDeviceId,
              inputDigest: attempt.inputDigest,
              inputMethod: attempt.inputMethod,
              source: "offline",
              outcome: "accepted",
              attemptedAt,
              rawDeviceTime,
              serverTimeAnchor: new Date(attempt.serverTimeAnchor),
              monotonicElapsedMs: attempt.monotonicElapsedMs,
              timestampConfidence: attempt.timestampConfidence,
            });
            return {
              id: attempt.id,
              ticketId: presentedTicket.id,
              outcome: "accepted" as const,
              changed: true,
            };
          }
        }

        await transaction.insert(scanAttempt).values({
          id: attempt.id,
          eventId: attempt.eventId,
          ticketId: presentedTicket?.id,
          actorUserId: payload.volunteerUserId,
          scannerDeviceId: attempt.scannerDeviceId,
          inputDigest: attempt.inputDigest,
          inputMethod: attempt.inputMethod,
          source: "offline",
          outcome,
          attemptedAt,
          rawDeviceTime,
          serverTimeAnchor: new Date(attempt.serverTimeAnchor),
          monotonicElapsedMs: attempt.monotonicElapsedMs,
          timestampConfidence: attempt.timestampConfidence,
        });
        return {
          id: attempt.id,
          ticketId: presentedTicket?.id ?? null,
          outcome,
          changed: outcome !== attempt.capturedOutcome,
        };
      });
      results.push(result);
    }
    return { outcome: "acknowledged", results };
  }

  return { synchronizeOfflineAttempts };
}
