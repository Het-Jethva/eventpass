"use client";

import Dexie, { type EntityTable } from "dexie";

import type { OfflineEventSnapshot } from "./offline-snapshot";

type ScannerProfileRecord = {
  key: "current";
  id: string;
  label: string;
};

type StoredSnapshot = {
  eventId: string;
  snapshot: OfflineEventSnapshot;
  performanceTimeOrigin: number;
  performanceNow: number;
};

export type PendingScanAttemptRecord = {
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
  authorization: string;
  scannerDeviceId: string;
};

class OfflineScannerDatabase extends Dexie {
  scannerProfile!: EntityTable<ScannerProfileRecord, "key">;
  snapshots!: EntityTable<StoredSnapshot, "eventId">;
  pendingScanAttempts!: EntityTable<PendingScanAttemptRecord, "id">;

  constructor(databaseName: string) {
    super(databaseName);
    this.version(1).stores({
      scannerProfile: "&key",
      snapshots: "&eventId",
      pendingScanAttempts: "&id,eventId",
    });
    this.version(2).stores({
      scannerProfile: "&key",
      snapshots: "&eventId",
      pendingScanAttempts: "&id,eventId,[eventId+ticketId]",
    });
  }
}

export class SnapshotReplacementRequiredError extends Error {
  constructor(
    readonly currentEventId: string,
    readonly currentEventName: string,
    readonly pendingAttemptCount: number,
  ) {
    super(`The cached Offline Event Snapshot belongs to ${currentEventName}.`);
    this.name = "SnapshotReplacementRequiredError";
  }
}

export function createOfflineScannerStore(
  databaseName = "eventpass-offline-scanner",
) {
  const database = new OfflineScannerDatabase(databaseName);

  async function getOrCreateScannerDevice() {
    const existing = await database.scannerProfile.get("current");
    if (existing) return { id: existing.id, label: existing.label };
    const created: ScannerProfileRecord = {
      key: "current",
      id: globalThis.crypto.randomUUID(),
      label: "",
    };
    await database.scannerProfile.add(created);
    return { id: created.id, label: created.label };
  }

  async function updateScannerDeviceLabel(label: string) {
    const device = await getOrCreateScannerDevice();
    await database.scannerProfile.put({ key: "current", ...device, label });
  }

  async function getCachedSnapshot() {
    return (await database.snapshots.toCollection().first())?.snapshot ?? null;
  }

  async function countPendingScanAttempts(eventId: string) {
    return database.pendingScanAttempts.where("eventId").equals(eventId).count();
  }

  async function cacheSnapshot(
    snapshot: OfflineEventSnapshot,
    options: { replaceExisting?: boolean } = {},
  ) {
    await database.transaction(
      "rw",
      database.snapshots,
      database.pendingScanAttempts,
      async () => {
        const existing = await database.snapshots.toCollection().first();
        if (existing && existing.eventId !== snapshot.event.id) {
          const pendingAttemptCount = await countPendingScanAttempts(
            existing.eventId,
          );
          if (!options.replaceExisting) {
            throw new SnapshotReplacementRequiredError(
              existing.eventId,
              existing.snapshot.event.name,
              pendingAttemptCount,
            );
          }
          await database.snapshots.delete(existing.eventId);
        }
        await database.snapshots.put({
          eventId: snapshot.event.id,
          snapshot,
          performanceTimeOrigin: performance.timeOrigin,
          performanceNow: performance.now(),
        });
      },
    );
  }

  async function captureAttemptTiming(eventId: string) {
    const stored = await database.snapshots.get(eventId);
    if (!stored) return null;
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
    const clockDriftMs = Math.abs(Date.now() - estimatedServerTime);
    return {
      serverTimeAnchor: stored.snapshot.serverTimeAnchor,
      monotonicElapsedMs,
      timestampConfidence:
        sameMonotonicClock && clockDriftMs <= 2 * 60 * 1000
          ? ("high" as const)
          : ("low" as const),
    };
  }

  async function savePendingScanAttempt(attempt: PendingScanAttemptRecord) {
    await database.pendingScanAttempts.put(attempt);
  }

  async function hasLocallyAcceptedTicket(eventId: string, ticketId: string) {
    const attempts = await database.pendingScanAttempts
      .where("[eventId+ticketId]")
      .equals([eventId, ticketId])
      .toArray();
    return attempts.some((attempt) => attempt.capturedOutcome === "provisional");
  }

  async function listPendingScanAttempts(eventId: string) {
    return database.pendingScanAttempts
      .where("eventId")
      .equals(eventId)
      .sortBy("deviceRecordedAt");
  }

  async function acknowledgeScanAttempts(
    eventId: string,
    results: Array<{
      id: string;
      ticketId: string | null;
      outcome: string;
    }>,
  ) {
    await database.transaction(
      "rw",
      database.snapshots,
      database.pendingScanAttempts,
      async () => {
        const stored = await database.snapshots.get(eventId);
        if (stored) {
          const checkedInTicketIds = new Set(
            results
              .filter(
                (result) =>
                  result.ticketId &&
                  (result.outcome === "accepted" ||
                    result.outcome === "duplicate"),
              )
              .map((result) => result.ticketId),
          );
          if (checkedInTicketIds.size > 0) {
            stored.snapshot.tickets = stored.snapshot.tickets.map((ticket) =>
              checkedInTicketIds.has(ticket.ticketId)
                ? { ...ticket, existingCheckInState: "checked_in" }
                : ticket,
            );
            await database.snapshots.put(stored);
          }
        }
        await database.pendingScanAttempts.bulkDelete(
          results
            .filter((result) => result.outcome !== "conflict")
            .map((result) => result.id),
        );
      },
    );
  }

  function close() {
    database.close();
  }

  return {
    getOrCreateScannerDevice,
    updateScannerDeviceLabel,
    getCachedSnapshot,
    cacheSnapshot,
    captureAttemptTiming,
    countPendingScanAttempts,
    savePendingScanAttempt,
    hasLocallyAcceptedTicket,
    listPendingScanAttempts,
    acknowledgeScanAttempts,
    close,
  };
}

export const offlineScannerStore = createOfflineScannerStore();
