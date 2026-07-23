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
};

export type PendingScanAttemptRecord = {
  id: string;
  eventId: string;
  recordedAt: string;
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
        });
      },
    );
  }

  async function savePendingScanAttempt(attempt: PendingScanAttemptRecord) {
    await database.pendingScanAttempts.put(attempt);
  }

  function close() {
    database.close();
  }

  return {
    getOrCreateScannerDevice,
    updateScannerDeviceLabel,
    getCachedSnapshot,
    cacheSnapshot,
    countPendingScanAttempts,
    savePendingScanAttempt,
    close,
  };
}

export const offlineScannerStore = createOfflineScannerStore();
