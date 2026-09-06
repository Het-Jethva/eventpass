import "server-only";

import type { KeyObject } from "node:crypto";

import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import {
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
import { digestBearerToken as digestInput } from "@/lib/bearer-token-digest";
import { verifyScannerAuthorization } from "../scanner-authorization";
import { arbitrateCheckInConflict } from "../check-in-conflict";
import { decideTicketValidity } from "../check-in-validity";
import { createCheckInConflictResolutionService } from "./check-in-conflict-resolution";

export { CheckInConflictError } from "./check-in-conflict-resolution";

type SynchronizationDatabase = typeof import("../../../lib/db").db;
type SynchronizationTransaction = Parameters<
  Parameters<SynchronizationDatabase["transaction"]>[0]
>[0];

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

type StoredAttemptState = {
  id: string;
  eventId: string;
  ticketId: string | null;
  checkInId: string | null;
  actorUserId: string;
  scannerDeviceId: string | null;
  inputDigest: string;
  inputMethod: string;
  source: string;
  outcome: string;
  attemptedAt: Date;
  rawDeviceTime: Date | null;
  serverTimeAnchor: Date | null;
  timestampConfidence: string | null;
};

type PresentedTicket = {
  id: string;
  code: string;
  status: string;
  registrationStatus: string;
  eventStatus: string;
  checkInOpensAt: Date;
  checkInClosesAt: Date;
};

type CompetingAttempt = {
  id: string;
  actorUserId: string;
  attemptedAt: Date;
  timestampConfidence: string | null;
  scannerDeviceId: string | null;
  checkInId: string | null;
};

type ActiveCheckIn = {
  id: string;
  actorUserId: string;
  checkedInAt: Date;
};

type StoredConflictState = {
  status: string;
  authoritativeScanAttemptId: string | null;
  createdAt: Date;
};

type PreparedAttempt = OfflineScanAttemptInput & {
  attemptedAt: Date;
  rawDeviceTime: Date;
  signedTicketIsValid: boolean;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeId(value: string) {
  return value.toLowerCase();
}

function attemptMatchesPresentedTicket(
  attempt: PreparedAttempt,
  presentedTicket: PresentedTicket,
) {
  if (attempt.signedTicket) return attempt.signedTicketIsValid;
  return digestInput(presentedTicket.code) === attempt.inputDigest;
}

function parseFiniteDate(value: string) {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function isValidScannerAuthorizationEnvelope(payload: {
  eventId: string;
  volunteerUserId: string;
  scannerDeviceId: string;
  issuedAt: string;
  expiresAt: string;
}) {
  const issuedAt = parseFiniteDate(payload.issuedAt);
  const expiresAt = parseFiniteDate(payload.expiresAt);
  return (
    UUID_PATTERN.test(payload.eventId) &&
    UUID_PATTERN.test(payload.volunteerUserId) &&
    UUID_PATTERN.test(payload.scannerDeviceId) &&
    issuedAt !== null &&
    expiresAt !== null &&
    expiresAt.getTime() > issuedAt.getTime()
  );
}

function reconciledStoredOutcome(
  existing: Pick<StoredAttemptState, "id" | "ticketId" | "outcome">,
  latestConflictsByTicket: Map<string, StoredConflictState>,
): StoredOutcome {
  if (!existing.ticketId) return existing.outcome as StoredOutcome;
  const conflict = latestConflictsByTicket.get(normalizeId(existing.ticketId));
  if (!conflict) return existing.outcome as StoredOutcome;
  if (conflict.status === "unresolved") return "conflict";
  return normalizeId(conflict.authoritativeScanAttemptId ?? "") ===
    normalizeId(existing.id)
    ? "accepted"
    : "duplicate";
}

async function lockAttemptIds(
  transaction: SynchronizationTransaction,
  attemptIds: string[],
) {
  for (const attemptId of [...new Set(attemptIds.map(normalizeId))].sort()) {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`offline-scan-attempt:${attemptId}`}, 0))`,
    );
  }
}

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
    const verifiedAuthorization = verifyScannerAuthorization(
      values.authorization,
      verificationKeys,
    );
    if (
      !verifiedAuthorization.valid ||
      !isValidScannerAuthorizationEnvelope(verifiedAuthorization.payload)
    ) {
      return { outcome: "unauthorized", results: [] };
    }

    const payload = verifiedAuthorization.payload;
    const authorizationIssuedAt = parseFiniteDate(payload.issuedAt);
    const authorizationExpiresAt = parseFiniteDate(payload.expiresAt);
    if (!authorizationIssuedAt || !authorizationExpiresAt) {
      return { outcome: "unauthorized", results: [] };
    }

    const preparedAttempts: PreparedAttempt[] = [];
    const firstAttemptById = new Map<string, PreparedAttempt>();
    for (const attempt of values.attempts) {
      const rawDeviceTime = parseFiniteDate(attempt.deviceRecordedAt);
      const serverTimeAnchor = parseFiniteDate(attempt.serverTimeAnchor);
      const attemptedAtMilliseconds =
        (serverTimeAnchor?.getTime() ?? Number.NaN) +
        attempt.monotonicElapsedMs;
      const attemptedAt = new Date(attemptedAtMilliseconds);
      const attemptKey = normalizeId(attempt.id);
      const firstAttempt = firstAttemptById.get(attemptKey);

      if (
        !UUID_PATTERN.test(attempt.id) ||
        (attempt.ticketId !== null && !UUID_PATTERN.test(attempt.ticketId)) ||
        attempt.eventId !== payload.eventId ||
        attempt.scannerDeviceId !== payload.scannerDeviceId ||
        attempt.serverTimeAnchor !== payload.issuedAt ||
        !Number.isSafeInteger(attempt.monotonicElapsedMs) ||
        attempt.monotonicElapsedMs < 0 ||
        !rawDeviceTime ||
        !serverTimeAnchor ||
        !Number.isFinite(attemptedAtMilliseconds) ||
        !Number.isFinite(attemptedAt.getTime()) ||
        (firstAttempt !== undefined &&
          (firstAttempt.inputDigest !== attempt.inputDigest ||
            firstAttempt.inputMethod !== attempt.inputMethod ||
            firstAttempt.ticketId !== attempt.ticketId))
      ) {
        return { outcome: "unauthorized", results: [] };
      }

      const ticketVerification = attempt.signedTicket
        ? verifyTicket(attempt.signedTicket, verificationKeys)
        : null;
      const preparedAttempt: PreparedAttempt = {
        ...attempt,
        attemptedAt,
        rawDeviceTime,
        signedTicketIsValid:
          ticketVerification?.valid === true &&
          ticketVerification.payload.eventId === attempt.eventId &&
          ticketVerification.payload.ticketId === attempt.ticketId,
      };
      preparedAttempts.push(preparedAttempt);
      if (!firstAttempt) firstAttemptById.set(attemptKey, preparedAttempt);
    }

    const attemptIds = [...firstAttemptById.keys()];
    return database.transaction(async (transaction) => {
      await lockAttemptIds(transaction, attemptIds);

      // A signed capability proves who held the device offline. It cannot prove
      // that access still stands, and this is the one admission path that never
      // asked: `admitOnline` and `prepareOfflineScanner` both check the staff
      // assignment and suspension, while synchronization wrote authoritative
      // Check-ins on the signature alone. ADR 0003 promises that online role
      // revocation takes effect immediately, and a device that is syncing is
      // online, so the promise has to be kept here.
      //
      // The two cases are not the same failure. A Suspension blocks further
      // online activity and is reversible, so the batch is refused and the
      // device keeps its queue to drain once the Suspension lifts. Revoked
      // staff access is not reversible on its own, and refusing those attempts
      // would strand them on the phone forever — the snapshot is purged only
      // once every attempt is acknowledged, and a PWA update is deferred while
      // any remain. Those attempts are recorded for the audit trail and denied
      // admission instead.
      const [eventRecord] = await transaction
        .select({ suspended: event.suspended })
        .from(event)
        .where(eq(event.id, payload.eventId))
        .limit(1);
      const [staffUser] = await transaction
        .select({ suspended: user.suspended })
        .from(user)
        .where(eq(user.id, payload.volunteerUserId))
        .limit(1);
      if (
        !eventRecord ||
        eventRecord.suspended ||
        !staffUser ||
        staffUser.suspended
      ) {
        return { outcome: "unauthorized", results: [] };
      }
      const [assignment] = await transaction
        .select({ role: eventStaff.role })
        .from(eventStaff)
        .where(
          and(
            eq(eventStaff.eventId, payload.eventId),
            eq(eventStaff.userId, payload.volunteerUserId),
          ),
        )
        .limit(1);
      const staffAccessRevoked = !assignment;

      const existingRows = await transaction
        .select({
          id: scanAttempt.id,
          eventId: scanAttempt.eventId,
          ticketId: scanAttempt.ticketId,
          checkInId: scanAttempt.checkInId,
          actorUserId: scanAttempt.actorUserId,
          scannerDeviceId: scanAttempt.scannerDeviceId,
          inputDigest: scanAttempt.inputDigest,
          inputMethod: scanAttempt.inputMethod,
          source: scanAttempt.source,
          outcome: scanAttempt.outcome,
          attemptedAt: scanAttempt.attemptedAt,
          rawDeviceTime: scanAttempt.rawDeviceTime,
          serverTimeAnchor: scanAttempt.serverTimeAnchor,
          timestampConfidence: scanAttempt.timestampConfidence,
        })
        .from(scanAttempt)
        .where(inArray(scanAttempt.id, attemptIds))
        .for("update");
      const existingById = new Map<string, StoredAttemptState>();
      for (const existing of existingRows) {
        const submitted = firstAttemptById.get(normalizeId(existing.id));
        if (
          existing.eventId !== payload.eventId ||
          (existing.source === "offline" &&
            (!submitted ||
              existing.actorUserId !== payload.volunteerUserId ||
              existing.scannerDeviceId !== payload.scannerDeviceId ||
              !existing.serverTimeAnchor ||
              existing.serverTimeAnchor.getTime() !==
                authorizationIssuedAt.getTime() ||
              existing.inputDigest !== submitted.inputDigest ||
              existing.inputMethod !== submitted.inputMethod))
        ) {
          return { outcome: "unauthorized", results: [] };
        }
        existingById.set(normalizeId(existing.id), existing);
      }

      const ticketIds = [
        ...new Set(
          [
            ...preparedAttempts.flatMap((attempt) =>
              attempt.ticketId ? [normalizeId(attempt.ticketId)] : [],
            ),
            ...existingRows.flatMap((attempt) =>
              attempt.ticketId ? [normalizeId(attempt.ticketId)] : [],
            ),
          ].sort(),
        ),
      ];

      const presentedTicketRows =
        ticketIds.length === 0
          ? []
          : await transaction
              .select({
                id: ticket.id,
                code: ticket.code,
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
                  eq(ticket.eventId, payload.eventId),
                  inArray(ticket.id, ticketIds),
                ),
              )
              .orderBy(asc(ticket.id))
              .for("update");
      const presentedTicketsById = new Map<string, PresentedTicket>();
      for (const presentedTicket of presentedTicketRows) {
        presentedTicketsById.set(normalizeId(presentedTicket.id), presentedTicket);
      }

      const activeCheckInRows =
        ticketIds.length === 0
          ? []
          : await transaction
              .select({
                id: checkIn.id,
                ticketId: checkIn.ticketId,
                actorUserId: checkIn.actorUserId,
                checkedInAt: checkIn.checkedInAt,
              })
              .from(checkIn)
              .where(
                and(
                  inArray(checkIn.ticketId, ticketIds),
                  isNull(checkIn.invalidatedAt),
                ),
              )
              .orderBy(asc(checkIn.ticketId))
              .for("update");
      const activeCheckInsByTicket = new Map<string, ActiveCheckIn>();
      for (const activeCheckIn of activeCheckInRows) {
        activeCheckInsByTicket.set(normalizeId(activeCheckIn.ticketId), activeCheckIn);
      }

      const competingAttemptRows =
        ticketIds.length === 0
          ? []
          : await transaction
              .select({
                id: scanAttempt.id,
                ticketId: scanAttempt.ticketId,
                actorUserId: scanAttempt.actorUserId,
                attemptedAt: scanAttempt.attemptedAt,
                timestampConfidence: scanAttempt.timestampConfidence,
                scannerDeviceId: scanAttempt.scannerDeviceId,
                checkInId: scanAttempt.checkInId,
              })
              .from(scanAttempt)
              .where(
                and(
                  inArray(scanAttempt.ticketId, ticketIds),
                  eq(scanAttempt.source, "offline"),
                  inArray(scanAttempt.outcome, ["accepted", "conflict"]),
                ),
              )
              .orderBy(
                asc(scanAttempt.ticketId),
                asc(scanAttempt.attemptedAt),
                asc(scanAttempt.id),
              )
              .for("update");
      const competingAttemptsByTicket = new Map<
        string,
        CompetingAttempt[]
      >();
      for (const competingAttempt of competingAttemptRows) {
        if (!competingAttempt.ticketId) continue;
        const ticketKey = normalizeId(competingAttempt.ticketId);
        const attempts = competingAttemptsByTicket.get(ticketKey) ?? [];
        attempts.push(competingAttempt);
        competingAttemptsByTicket.set(ticketKey, attempts);
      }

      const conflictRows =
        ticketIds.length === 0
          ? []
          : await transaction
              .select({
                ticketId: checkInConflict.ticketId,
                status: checkInConflict.status,
                authoritativeScanAttemptId:
                  checkInConflict.authoritativeScanAttemptId,
                createdAt: checkInConflict.createdAt,
              })
              .from(checkInConflict)
              .where(inArray(checkInConflict.ticketId, ticketIds))
              .orderBy(
                asc(checkInConflict.ticketId),
                desc(checkInConflict.createdAt),
              );
      const latestConflictsByTicket = new Map<
        string,
        StoredConflictState
      >();
      for (const conflict of conflictRows) {
        const ticketKey = normalizeId(conflict.ticketId);
        if (!latestConflictsByTicket.has(ticketKey)) {
          latestConflictsByTicket.set(ticketKey, conflict);
        }
      }

      const reconciliationNow = now();
      const results: OfflineSynchronizationResult[] = [];

      const rememberCompetingAttempt = (stored: StoredAttemptState) => {
        if (
          !stored.ticketId ||
          (stored.outcome !== "accepted" && stored.outcome !== "conflict")
        ) {
          return;
        }
        const ticketKey = normalizeId(stored.ticketId);
        const attempts = competingAttemptsByTicket.get(ticketKey) ?? [];
        attempts.push({
          id: stored.id,
          actorUserId: stored.actorUserId,
          attemptedAt: stored.attemptedAt,
          timestampConfidence: stored.timestampConfidence,
          scannerDeviceId: stored.scannerDeviceId,
          checkInId: stored.checkInId,
        });
        competingAttemptsByTicket.set(ticketKey, attempts);
      };

      const rememberStoredAttempt = async ({
        attempt,
        ticketId,
        checkInId,
        outcome,
      }: {
        attempt: PreparedAttempt;
        ticketId: string | null;
        checkInId: string | null;
        outcome: StoredOutcome;
      }) => {
        const stored: StoredAttemptState = {
          id: attempt.id,
          eventId: attempt.eventId,
          ticketId,
          checkInId,
          actorUserId: payload.volunteerUserId,
          scannerDeviceId: attempt.scannerDeviceId,
          inputDigest: attempt.inputDigest,
          inputMethod: attempt.inputMethod,
          source: "offline",
          outcome,
          attemptedAt: attempt.attemptedAt,
          rawDeviceTime: attempt.rawDeviceTime,
          serverTimeAnchor: authorizationIssuedAt,
          timestampConfidence: attempt.timestampConfidence,
        };
        await transaction.insert(scanAttempt).values({
          id: stored.id,
          eventId: stored.eventId,
          ticketId: stored.ticketId,
          checkInId: stored.checkInId,
          actorUserId: stored.actorUserId,
          scannerDeviceId: stored.scannerDeviceId,
          inputDigest: stored.inputDigest,
          inputMethod: stored.inputMethod,
          source: stored.source,
          outcome: stored.outcome,
          attemptedAt: stored.attemptedAt,
          rawDeviceTime: stored.rawDeviceTime,
          serverTimeAnchor: stored.serverTimeAnchor,
          monotonicElapsedMs: attempt.monotonicElapsedMs,
          timestampConfidence: stored.timestampConfidence,
        });
        existingById.set(normalizeId(stored.id), stored);
        rememberCompetingAttempt(stored);
        return stored;
      };

      for (const attempt of preparedAttempts) {
        const attemptKey = normalizeId(attempt.id);
        const existing = existingById.get(attemptKey);
        if (existing) {
          const outcome = reconciledStoredOutcome(
            existing,
            latestConflictsByTicket,
          );
          results.push({
            id: existing.id,
            ticketId: existing.ticketId,
            outcome,
            changed: outcome !== attempt.capturedOutcome,
          });
          continue;
        }

        const presentedTicket = attempt.ticketId
          ? presentedTicketsById.get(normalizeId(attempt.ticketId))
          : undefined;
        const authorizationExpired =
          attempt.attemptedAt > authorizationExpiresAt ||
          attempt.attemptedAt >
            new Date(reconciliationNow.getTime() + 5 * 60 * 1000);
        let outcome: StoredOutcome | null = null;
        let stored: StoredAttemptState | undefined;

        if (
          attempt.capturedOutcome === "invalid" ||
          attempt.capturedOutcome === "unknown"
        ) {
          outcome = attempt.capturedOutcome;
        } else if (
          authorizationExpired ||
          staffAccessRevoked ||
          !presentedTicket ||
          !attemptMatchesPresentedTicket(attempt, presentedTicket)
        ) {
          outcome = !presentedTicket ? "unknown" : "invalid";
        } else {
          const decision = decideTicketValidity({
            statuses: {
              eventStatus: presentedTicket.eventStatus,
              registrationStatus: presentedTicket.registrationStatus,
              ticketStatus: presentedTicket.status,
            },
            credentialValid: true,
            attemptedAt: attempt.attemptedAt,
            checkInOpensAt: presentedTicket.checkInOpensAt,
            checkInClosesAt: presentedTicket.checkInClosesAt,
            canOverrideWindow: false,
          });
          if (decision.verdict === "refuse") {
            outcome = decision.reason;
          } else if (attempt.capturedOutcome !== "provisional") {
            outcome = attempt.capturedOutcome;
          } else {
            const ticketKey = normalizeId(presentedTicket.id);
            const competingAttempts = (
              competingAttemptsByTicket.get(ticketKey) ?? []
            ).filter(
              (candidate) =>
                candidate.scannerDeviceId !== attempt.scannerDeviceId,
            );
            const directive = arbitrateCheckInConflict({
              attempt: {
                id: attempt.id,
                actorUserId: payload.volunteerUserId,
                attemptedAt: attempt.attemptedAt,
                timestampConfidence: attempt.timestampConfidence,
              },
              competing: competingAttempts.map((candidate) => ({
                id: candidate.id,
                actorUserId: candidate.actorUserId,
                attemptedAt: candidate.attemptedAt,
                timestampConfidence: candidate.timestampConfidence,
              })),
              activeCheckIn: activeCheckInsByTicket.get(ticketKey),
              currentConflictStatus:
                latestConflictsByTicket.get(ticketKey)?.status,
            });
            let linkedCheckInId: string | null = null;
            if (directive.invalidateActiveCheckIn) {
              const activeCheckIn = activeCheckInsByTicket.get(ticketKey);
              if (activeCheckIn) {
                await transaction
                  .update(checkIn)
                  .set({ invalidatedAt: reconciliationNow })
                  .where(eq(checkIn.id, activeCheckIn.id));
                activeCheckInsByTicket.delete(ticketKey);
              }
            }
            if (directive.createCheckInFor) {
              const [createdCheckIn] = await transaction
                .insert(checkIn)
                .values({
                  eventId: attempt.eventId,
                  ticketId: presentedTicket.id,
                  actorUserId: directive.createCheckInFor.actorUserId,
                  checkedInAt: directive.createCheckInFor.checkedInAt,
                })
                .returning({ id: checkIn.id });
              if (!createdCheckIn) {
                throw new Error("Failed to create the reconciled Check-in.");
              }
              activeCheckInsByTicket.set(ticketKey, {
                id: createdCheckIn.id,
                actorUserId: directive.createCheckInFor.actorUserId,
                checkedInAt: directive.createCheckInFor.checkedInAt,
              });
              linkedCheckInId = createdCheckIn.id;
            } else if (directive.linkAttemptToActiveCheckIn) {
              linkedCheckInId =
                activeCheckInsByTicket.get(ticketKey)?.id ?? null;
            }
            // Persist the Scan Attempt before any Check-in Conflict that may
            // name it as authoritative. Postgres checks the foreign key at
            // insert, so a resolved_auto row cannot point at an attempt that
            // is still only in memory.
            if (directive.attemptOutcome === "conflict") {
              stored = await rememberStoredAttempt({
                attempt,
                ticketId: presentedTicket.id,
                checkInId: null,
                outcome: "conflict",
              });
            } else if (directive.attemptOutcome === "accepted") {
              stored = await rememberStoredAttempt({
                attempt,
                ticketId: presentedTicket.id,
                checkInId: linkedCheckInId,
                outcome: "accepted",
              });
            } else {
              stored = await rememberStoredAttempt({
                attempt,
                ticketId: presentedTicket.id,
                checkInId: null,
                outcome: "duplicate",
              });
            }
            if (directive.ensureConflict?.status === "unresolved") {
              const [createdConflict] = await transaction
                .insert(checkInConflict)
                .values({
                  eventId: attempt.eventId,
                  ticketId: presentedTicket.id,
                })
                .returning({ createdAt: checkInConflict.createdAt });
              latestConflictsByTicket.set(ticketKey, {
                status: "unresolved",
                authoritativeScanAttemptId: null,
                createdAt: createdConflict?.createdAt ?? reconciliationNow,
              });
            } else if (directive.ensureConflict?.status === "resolved_auto") {
              const [createdConflict] = await transaction
                .insert(checkInConflict)
                .values({
                  eventId: attempt.eventId,
                  ticketId: presentedTicket.id,
                  status: "resolved_auto",
                  authoritativeScanAttemptId:
                    directive.ensureConflict.authoritativeScanAttemptId,
                  resolvedAt: reconciliationNow,
                })
                .returning({ createdAt: checkInConflict.createdAt });
              latestConflictsByTicket.set(ticketKey, {
                status: "resolved_auto",
                authoritativeScanAttemptId:
                  directive.ensureConflict.authoritativeScanAttemptId,
                createdAt: createdConflict?.createdAt ?? reconciliationNow,
              });
            }
          }
        }

        if (!stored) {
          if (!outcome) {
            throw new Error("Offline Scan Attempt reconciliation produced no outcome.");
          }
          stored = await rememberStoredAttempt({
            attempt,
            ticketId: presentedTicket?.id ?? null,
            checkInId: null,
            outcome,
          });
        }
        results.push({
          id: stored.id,
          ticketId: stored.ticketId,
          outcome: stored.outcome as StoredOutcome,
          changed: stored.outcome !== attempt.capturedOutcome,
        });
      }

      return { outcome: "acknowledged", results };
    });
  }

  const conflictResolution = createCheckInConflictResolutionService({
    database,
    now,
  });

  return {
    synchronizeOfflineAttempts,
    listCheckInConflicts: conflictResolution.listCheckInConflicts,
    resolveCheckInConflict: conflictResolution.resolveCheckInConflict,
  };
}
