import type { KeyObject } from "node:crypto";

import { and, asc, desc, eq, inArray, isNull, ne } from "drizzle-orm";

import {
  auditEntry,
  checkIn,
  checkInConflict,
  event,
  eventStaff,
  registration,
  scanAttempt,
  ticket,
  user,
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
    | "outside_window"
    | "conflict";
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
  async function reconciledStoredOutcome(
    transaction: Parameters<
      Parameters<SynchronizationDatabase["transaction"]>[0]
    >[0],
    existing: { id: string; ticketId: string | null; outcome: string },
  ): Promise<StoredOutcome> {
    if (!existing.ticketId) return existing.outcome as StoredOutcome;
    const [conflict] = await transaction
      .select({
        status: checkInConflict.status,
        authoritativeScanAttemptId:
          checkInConflict.authoritativeScanAttemptId,
      })
      .from(checkInConflict)
      .where(eq(checkInConflict.ticketId, existing.ticketId))
      .orderBy(desc(checkInConflict.createdAt))
      .limit(1);
    if (!conflict) return existing.outcome as StoredOutcome;
    if (conflict.status === "unresolved") return "conflict";
    return conflict.authoritativeScanAttemptId === existing.id
      ? "accepted"
      : "duplicate";
  }

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
          const outcome = await reconciledStoredOutcome(transaction, existing);
          return {
            id: existing.id,
            ticketId: existing.ticketId,
            outcome,
            changed: outcome !== attempt.capturedOutcome,
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
          const competingAttempts = await transaction
            .select({
              id: scanAttempt.id,
              actorUserId: scanAttempt.actorUserId,
              attemptedAt: scanAttempt.attemptedAt,
              timestampConfidence: scanAttempt.timestampConfidence,
              scannerDeviceId: scanAttempt.scannerDeviceId,
              checkInId: scanAttempt.checkInId,
            })
            .from(scanAttempt)
            .where(
              and(
                eq(scanAttempt.ticketId, presentedTicket.id),
                eq(scanAttempt.source, "offline"),
                ne(scanAttempt.scannerDeviceId, attempt.scannerDeviceId),
                inArray(scanAttempt.outcome, ["accepted", "conflict"]),
              ),
            )
            .for("update");

          if (competingAttempts.length > 0) {
            const hasLowConfidence =
              attempt.timestampConfidence === "low" ||
              competingAttempts.some(
                (candidate) => candidate.timestampConfidence === "low",
              );
            if (hasLowConfidence) {
              await transaction
                .update(checkIn)
                .set({ invalidatedAt: now() })
                .where(
                  and(
                    eq(checkIn.ticketId, presentedTicket.id),
                    isNull(checkIn.invalidatedAt),
                  ),
                );
              await transaction.insert(scanAttempt).values({
                id: attempt.id,
                eventId: attempt.eventId,
                ticketId: presentedTicket.id,
                actorUserId: payload.volunteerUserId,
                scannerDeviceId: attempt.scannerDeviceId,
                inputDigest: attempt.inputDigest,
                inputMethod: attempt.inputMethod,
                source: "offline",
                outcome: "conflict",
                attemptedAt,
                rawDeviceTime,
                serverTimeAnchor: new Date(attempt.serverTimeAnchor),
                monotonicElapsedMs: attempt.monotonicElapsedMs,
                timestampConfidence: attempt.timestampConfidence,
              });
              const [activeConflict] = await transaction
                .select({ id: checkInConflict.id })
                .from(checkInConflict)
                .where(
                  and(
                    eq(checkInConflict.ticketId, presentedTicket.id),
                    eq(checkInConflict.status, "unresolved"),
                  ),
                )
                .limit(1);
              if (!activeConflict) {
                await transaction.insert(checkInConflict).values({
                  eventId: attempt.eventId,
                  ticketId: presentedTicket.id,
                });
              }
              return {
                id: attempt.id,
                ticketId: presentedTicket.id,
                outcome: "conflict" as const,
                changed: true,
              };
            }

            const candidates = [
              ...competingAttempts,
              {
                id: attempt.id,
                actorUserId: payload.volunteerUserId,
                attemptedAt,
                timestampConfidence: attempt.timestampConfidence,
                scannerDeviceId: attempt.scannerDeviceId,
                checkInId: null,
              },
            ].sort(
              (left, right) =>
                left.attemptedAt.getTime() - right.attemptedAt.getTime() ||
                left.id.localeCompare(right.id),
            );
            const winner = candidates[0]!;
            let winningCheckInId: string | null = null;
            const [activeCheckIn] = await transaction
              .select({
                id: checkIn.id,
                actorUserId: checkIn.actorUserId,
                checkedInAt: checkIn.checkedInAt,
              })
              .from(checkIn)
              .where(
                and(
                  eq(checkIn.ticketId, presentedTicket.id),
                  isNull(checkIn.invalidatedAt),
                ),
              )
              .limit(1);
            if (
              activeCheckIn &&
              activeCheckIn.actorUserId === winner.actorUserId &&
              activeCheckIn.checkedInAt.getTime() ===
                winner.attemptedAt.getTime()
            ) {
              winningCheckInId = activeCheckIn.id;
            } else {
              if (activeCheckIn) {
                await transaction
                  .update(checkIn)
                  .set({ invalidatedAt: now() })
                  .where(eq(checkIn.id, activeCheckIn.id));
              }
              const [createdCheckIn] = await transaction
                .insert(checkIn)
                .values({
                  eventId: attempt.eventId,
                  ticketId: presentedTicket.id,
                  actorUserId: winner.actorUserId,
                  checkedInAt: winner.attemptedAt,
                })
                .returning({ id: checkIn.id });
              winningCheckInId = createdCheckIn!.id;
            }

            const newAttemptWon = winner.id === attempt.id;
            await transaction.insert(scanAttempt).values({
              id: attempt.id,
              eventId: attempt.eventId,
              ticketId: presentedTicket.id,
              checkInId: newAttemptWon ? winningCheckInId : null,
              actorUserId: payload.volunteerUserId,
              scannerDeviceId: attempt.scannerDeviceId,
              inputDigest: attempt.inputDigest,
              inputMethod: attempt.inputMethod,
              source: "offline",
              outcome: newAttemptWon ? "accepted" : "duplicate",
              attemptedAt,
              rawDeviceTime,
              serverTimeAnchor: new Date(attempt.serverTimeAnchor),
              monotonicElapsedMs: attempt.monotonicElapsedMs,
              timestampConfidence: attempt.timestampConfidence,
            });
            await transaction.insert(checkInConflict).values({
              eventId: attempt.eventId,
              ticketId: presentedTicket.id,
              status: "resolved_auto",
              authoritativeScanAttemptId: winner.id,
              resolvedAt: now(),
            });
            return {
              id: attempt.id,
              ticketId: presentedTicket.id,
              outcome: newAttemptWon ? ("accepted" as const) : ("duplicate" as const),
              changed: true,
            };
          }

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

    return Promise.all(
      conflicts.map(async (conflict) => {
        const attempts = await database
          .select({
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
              eq(scanAttempt.ticketId, conflict.ticketId),
              eq(scanAttempt.source, "offline"),
              inArray(scanAttempt.outcome, ["accepted", "conflict"]),
            ),
          )
          .orderBy(asc(scanAttempt.attemptedAt), asc(scanAttempt.id));
        return { ...conflict, attempts };
      }),
    );
  }

  async function resolveCheckInConflict(values: {
    conflictId: string;
    actorUserId: string;
    authoritativeAttemptId: string;
    reason: string;
  }) {
    const reason = values.reason.trim();
    if (!reason) throw new Error("A resolution reason is required.");

    return database.transaction(async (transaction) => {
      const [conflict] = await transaction
        .select()
        .from(checkInConflict)
        .where(eq(checkInConflict.id, values.conflictId))
        .for("update")
        .limit(1);
      if (!conflict || conflict.status !== "unresolved") {
        throw new Error("This Check-in Conflict is no longer unresolved.");
      }
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
        throw new Error("Only an Organizer can resolve Check-in Conflicts.");
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
        throw new Error("Select a Scan Attempt from this Check-in Conflict.");
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

  return {
    synchronizeOfflineAttempts,
    listCheckInConflicts,
    resolveCheckInConflict,
  };
}
