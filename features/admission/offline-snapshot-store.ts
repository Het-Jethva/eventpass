"use client";

import Dexie, { type EntityTable, type Table } from "dexie";

import type { AdmissionResult, OfflineScanAttemptInput } from "./admission";
import {
  decideSnapshotTicketOutcome,
  parseStoredSnapshotValidity,
} from "./check-in-validity";
import {
  getSnapshotReadiness,
  type OfflineEventSnapshot,
} from "./offline-snapshot";
import type { StoredScanOutcome } from "./scan-outcomes";

type ScannerProfileRecord = { key: "current"; id: string; label: string };
type SnapshotMetadata = Omit<OfflineEventSnapshot, "tickets">;
type SnapshotTicket = OfflineEventSnapshot["tickets"][number];
type StoredTicket = SnapshotTicket & { eventId: string };
type StoredSnapshot = {
  eventId: string;
  snapshot: SnapshotMetadata;
  performanceTimeOrigin: number;
  performanceNow: number;
};

type PendingScanAttemptRecord = OfflineScanAttemptInput & {
  authorization: string;
};

type VerifiedOfflineCredential =
  | { kind: "code"; code: string }
  | { kind: "signed"; eventId: string; ticketId: string; signedTicket: string }
  | { kind: "invalid" };

type OfflineScan = {
  eventId: string;
  clientAttemptId: string;
  inputMethod: OfflineScanAttemptInput["inputMethod"];
  inputDigest: string;
  authorization: string;
  credential: VerifiedOfflineCredential;
};

class OfflineScannerDatabase extends Dexie {
  scannerProfile!: EntityTable<ScannerProfileRecord, "key">;
  snapshots!: EntityTable<StoredSnapshot, "eventId">;
  tickets!: Table<StoredTicket, [string, string]>;
  pendingScanAttempts!: EntityTable<PendingScanAttemptRecord, "id">;

  constructor(databaseName: string) {
    super(databaseName);
    this.version(1).stores({
      scannerProfile: "&key",
      snapshots: "&eventId",
      pendingScanAttempts: "&id,eventId",
    });
    this.version(2).stores({
      pendingScanAttempts: "&id,eventId,[eventId+ticketId]",
    });
    this.version(3)
      .stores({
        tickets: "&[eventId+ticketId],&[eventId+ticketCode],eventId",
      })
      .upgrade(async (transaction) => {
        type PreviousSnapshot = Omit<StoredSnapshot, "snapshot"> & {
          snapshot: OfflineEventSnapshot;
        };
        const previous = await transaction
          .table<PreviousSnapshot>("snapshots")
          .toArray();
        for (const stored of previous) {
          const { tickets, ...snapshot } = stored.snapshot;
          await transaction
            .table<StoredTicket>("tickets")
            .bulkPut(
              tickets.map((ticket) => ({ ...ticket, eventId: stored.eventId })),
            );
          await transaction
            .table<StoredSnapshot>("snapshots")
            .put({ ...stored, snapshot });
        }
      });
  }
}

export class SnapshotReplacementRequiredError extends Error {
  readonly currentEventId: string;
  readonly currentEventName: string;
  readonly pendingAttemptCount: number;

  constructor(
    currentEventId: string,
    currentEventName: string,
    pendingAttemptCount: number,
  ) {
    super(`The cached Offline Event Snapshot belongs to ${currentEventName}.`);
    this.name = "SnapshotReplacementRequiredError";
    this.currentEventId = currentEventId;
    this.currentEventName = currentEventName;
    this.pendingAttemptCount = pendingAttemptCount;
  }
}

function captureAttemptTiming(stored: StoredSnapshot) {
  const sameMonotonicClock =
    stored.performanceTimeOrigin === performance.timeOrigin;
  const monotonicElapsedMs = sameMonotonicClock
    ? Math.max(0, Math.round(performance.now() - stored.performanceNow))
    : Math.max(
        0,
        Date.now() - new Date(stored.snapshot.serverTimeAnchor).getTime(),
      );
  const estimatedServerTime =
    new Date(stored.snapshot.serverTimeAnchor).getTime() + monotonicElapsedMs;
  const timestampConfidence: "high" | "low" =
    sameMonotonicClock &&
    Math.abs(Date.now() - estimatedServerTime) <= 2 * 60 * 1000
      ? "high"
      : "low";
  return {
    serverTimeAnchor: stored.snapshot.serverTimeAnchor,
    monotonicElapsedMs,
    timestampConfidence,
  };
}

export function createOfflineScannerStore(
  databaseName = "eventpass-offline-scanner",
) {
  const database = new OfflineScannerDatabase(databaseName);

  async function getOrCreateScannerDevice() {
    return database.transaction("rw", database.scannerProfile, async () => {
      const existing = await database.scannerProfile.get("current");
      if (existing) return { id: existing.id, label: existing.label };
      const created: ScannerProfileRecord = {
        key: "current",
        id: crypto.randomUUID(),
        label: "",
      };
      await database.scannerProfile.add(created);
      return { id: created.id, label: created.label };
    });
  }

  async function updateScannerDeviceLabel(label: string) {
    const device = await getOrCreateScannerDevice();
    await database.scannerProfile.put({ key: "current", ...device, label });
  }

  async function getCachedSnapshot(): Promise<OfflineEventSnapshot | null> {
    return database.transaction(
      "r",
      database.snapshots,
      database.tickets,
      async () => {
        const stored = await database.snapshots.toCollection().first();
        if (!stored) return null;
        const tickets = await database.tickets
          .where("eventId")
          .equals(stored.eventId)
          .toArray();
        return {
          ...stored.snapshot,
          tickets: tickets.map((ticket) => ({
            ticketId: ticket.ticketId,
            ticketCode: ticket.ticketCode,
            displayName: ticket.displayName,
            validityState: ticket.validityState,
            existingCheckInState: ticket.existingCheckInState,
          })),
        };
      },
    );
  }

  async function getVerificationContext(eventId: string) {
    const stored = await database.snapshots.get(eventId);
    return stored
      ? {
          authorization: stored.snapshot.authorization,
          verificationKeys: stored.snapshot.verificationKeys,
        }
      : null;
  }

  async function countPendingScanAttempts(eventId: string) {
    return database.pendingScanAttempts
      .where("eventId")
      .equals(eventId)
      .count();
  }

  async function cacheSnapshot(
    snapshot: OfflineEventSnapshot,
    options: { replaceExisting?: boolean } = {},
  ) {
    await database.transaction(
      "rw",
      database.snapshots,
      database.tickets,
      database.pendingScanAttempts,
      async () => {
        const existing = await database.snapshots.toCollection().first();
        if (existing && existing.eventId !== snapshot.event.id) {
          const pendingCount = await countPendingScanAttempts(existing.eventId);
          if (!options.replaceExisting) {
            throw new SnapshotReplacementRequiredError(
              existing.eventId,
              existing.snapshot.event.name,
              pendingCount,
            );
          }
          await database.snapshots.delete(existing.eventId);
          await database.tickets
            .where("eventId")
            .equals(existing.eventId)
            .delete();
        }
        const { tickets, ...metadata } = snapshot;
        await database.tickets
          .where("eventId")
          .equals(snapshot.event.id)
          .delete();
        await database.tickets.bulkPut(
          tickets.map((ticket) => ({ ...ticket, eventId: snapshot.event.id })),
        );
        await database.snapshots.put({
          eventId: snapshot.event.id,
          snapshot: metadata,
          performanceTimeOrigin: performance.timeOrigin,
          performanceNow: performance.now(),
        });
      },
    );
  }

  async function recordScan(
    input: OfflineScan,
  ): Promise<AdmissionResult | { outcome: "snapshot_changed" }> {
    return database.transaction(
      "rw",
      database.snapshots,
      database.tickets,
      database.pendingScanAttempts,
      async () => {
        const existing = await database.pendingScanAttempts.get(
          input.clientAttemptId,
        );
        if (existing) {
          if (
            existing.eventId !== input.eventId ||
            existing.inputDigest !== input.inputDigest ||
            existing.inputMethod !== input.inputMethod
          )
            return { outcome: "invalid" };
          const ticket = existing.ticketId
            ? await database.tickets.get([input.eventId, existing.ticketId])
            : undefined;
          return {
            outcome: existing.capturedOutcome,
            attendeeName: ticket?.displayName,
          };
        }
        const stored = await database.snapshots.get(input.eventId);
        if (!stored) return { outcome: "unauthorized" };
        if (stored.snapshot.authorization !== input.authorization)
          return { outcome: "snapshot_changed" };
        const timing = captureAttemptTiming(stored);
        const attemptedAt = new Date(
          new Date(timing.serverTimeAnchor).getTime() +
            timing.monotonicElapsedMs,
        );
        const snapshot = stored.snapshot;
        if (getSnapshotReadiness(snapshot, attemptedAt) === "refresh_required")
          return { outcome: "snapshot_stale" };
        const credential = input.credential;
        const ticket =
          credential.kind === "code"
            ? await database.tickets
                .where("[eventId+ticketCode]")
                .equals([input.eventId, credential.code])
                .first()
            : credential.kind === "signed" &&
                credential.eventId === input.eventId
              ? await database.tickets.get([input.eventId, credential.ticketId])
              : undefined;
        let outcome: OfflineScanAttemptInput["capturedOutcome"];
        if (
          credential.kind === "invalid" ||
          (credential.kind === "signed" && credential.eventId !== input.eventId)
        ) {
          outcome = "invalid";
        } else if (!ticket) {
          outcome = "unknown";
        } else {
          const validity = parseStoredSnapshotValidity(ticket.validityState);
          const refusal =
            validity === "invalid"
              ? "invalid"
              : decideSnapshotTicketOutcome({
                  validityState: validity,
                  attemptedAt,
                  checkInOpensAt: new Date(snapshot.event.checkInOpensAt),
                  checkInClosesAt: new Date(snapshot.event.checkInClosesAt),
                });
          if (refusal) outcome = refusal;
          else if (ticket.existingCheckInState === "conflict") {
            return { outcome: "conflict", attendeeName: ticket.displayName };
          } else {
            const locallyAccepted = await database.pendingScanAttempts
              .where("[eventId+ticketId]")
              .equals([input.eventId, ticket.ticketId])
              .filter((attempt) => attempt.capturedOutcome === "provisional")
              .first();
            outcome =
              ticket.existingCheckInState === "checked_in" || locallyAccepted
                ? "duplicate"
                : "provisional";
          }
        }
        await database.pendingScanAttempts.add({
          id: input.clientAttemptId,
          eventId: input.eventId,
          ticketId: ticket?.ticketId ?? null,
          inputDigest: input.inputDigest,
          inputMethod: input.inputMethod,
          capturedOutcome: outcome,
          deviceRecordedAt: new Date().toISOString(),
          ...timing,
          signedTicket:
            ticket && credential.kind === "signed"
              ? credential.signedTicket
              : null,
          authorization: snapshot.authorization,
          scannerDeviceId: snapshot.scannerDevice.id,
        });
        return { outcome, attendeeName: ticket?.displayName };
      },
    );
  }

  async function listPendingScanAttempts(eventId: string) {
    return database.pendingScanAttempts
      .where("eventId")
      .equals(eventId)
      .sortBy("deviceRecordedAt");
  }

  async function applyAdmissionResults(
    eventId: string,
    results: ReadonlyArray<{
      ticketId: string | null;
      outcome: StoredScanOutcome | AdmissionResult["outcome"];
    }>,
    acknowledgedAttemptIds: string[] = [],
  ) {
    const changesByTicket = new Map<
      string,
      Partial<Pick<SnapshotTicket, "validityState" | "existingCheckInState">>
    >();
    for (const result of results) {
      if (!result.ticketId) continue;
      const changes = changesByTicket.get(result.ticketId) ?? {};
      switch (result.outcome) {
        case "canceled":
        case "replaced":
        case "expired":
          changes.validityState = result.outcome;
          break;
        case "conflict":
          changes.existingCheckInState = "conflict";
          break;
        case "accepted":
        case "duplicate":
          if (changes.existingCheckInState !== "conflict") {
            changes.existingCheckInState = "checked_in";
          }
          break;
        case "not_checked_in":
          changes.existingCheckInState ??= "not_checked_in";
          break;
        default:
          continue;
      }
      changesByTicket.set(result.ticketId, changes);
    }
    await database.transaction(
      "rw",
      database.tickets,
      database.pendingScanAttempts,
      async () => {
        for (const [ticketId, changes] of changesByTicket) {
          await database.tickets.update([eventId, ticketId], changes);
        }
        const pending = await database.pendingScanAttempts.bulkGet(
          acknowledgedAttemptIds,
        );
        await database.pendingScanAttempts.bulkDelete(
          pending.flatMap((attempt) =>
            attempt?.eventId === eventId ? [attempt.id] : [],
          ),
        );
      },
    );
  }

  async function purgeEventIfClosedAndAcknowledged(
    eventId: string,
    now = new Date(),
  ) {
    return database.transaction(
      "rw",
      database.snapshots,
      database.tickets,
      database.pendingScanAttempts,
      async () => {
        const stored = await database.snapshots.get(eventId);
        if (
          !stored ||
          now < new Date(stored.snapshot.event.checkInClosesAt) ||
          (await countPendingScanAttempts(eventId)) > 0
        )
          return false;
        await database.snapshots.delete(eventId);
        await database.tickets.where("eventId").equals(eventId).delete();
        return true;
      },
    );
  }

  return {
    getOrCreateScannerDevice,
    updateScannerDeviceLabel,
    getCachedSnapshot,
    getVerificationContext,
    cacheSnapshot,
    recordScan,
    countPendingScanAttempts,
    countAllPendingScanAttempts: () => database.pendingScanAttempts.count(),
    purgeEventIfClosedAndAcknowledged,
    listPendingScanAttempts,
    applyAdmissionResults,
    close: () => database.close(),
  };
}

export const offlineScannerStore = createOfflineScannerStore();
