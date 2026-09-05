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

type SnapshotCache = {
  stored: StoredSnapshot;
  ticketsById: Map<string, OfflineEventSnapshot["tickets"][number]>;
  ticketsByCode: Map<string, OfflineEventSnapshot["tickets"][number]>;
  locallyAcceptedTicketIds: Set<string>;
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
  let snapshotCache: SnapshotCache | null = null;
  let snapshotCacheLoaded = false;
  let snapshotCacheLoad: Promise<SnapshotCache | null> | null = null;
  let snapshotMutationQueue = Promise.resolve();

  function createSnapshotCache(
    stored: StoredSnapshot,
    locallyAcceptedTicketIds: Set<string>,
  ): SnapshotCache {
    return {
      stored,
      ticketsById: new Map(
        stored.snapshot.tickets.map((ticket) => [ticket.ticketId, ticket]),
      ),
      ticketsByCode: new Map(
        stored.snapshot.tickets.map((ticket) => [ticket.ticketCode, ticket]),
      ),
      locallyAcceptedTicketIds,
    };
  }

  async function readLocallyAcceptedTicketIds(eventId: string) {
    const attempts = await database.pendingScanAttempts
      .where("eventId")
      .equals(eventId)
      .filter(
        (attempt) =>
          attempt.capturedOutcome === "provisional" &&
          attempt.ticketId !== null,
      )
      .toArray();
    return new Set(
      attempts.flatMap((attempt) =>
        attempt.ticketId ? [attempt.ticketId] : [],
      ),
    );
  }

  async function ensureSnapshotCache() {
    if (snapshotCacheLoaded) return snapshotCache;
    if (snapshotCacheLoad) return snapshotCacheLoad;

    snapshotCacheLoad = (async () => {
      const stored = await database.snapshots.toCollection().first();
      if (!stored) {
        snapshotCache = null;
        snapshotCacheLoaded = true;
        return null;
      }

      snapshotCache = createSnapshotCache(
        stored,
        await readLocallyAcceptedTicketIds(stored.eventId),
      );
      snapshotCacheLoaded = true;
      return snapshotCache;
    })();

    try {
      return await snapshotCacheLoad;
    } finally {
      snapshotCacheLoad = null;
    }
  }

  function enqueueSnapshotMutation<T>(mutation: () => Promise<T>) {
    const next = snapshotMutationQueue.then(
      () => mutation(),
      () => mutation(),
    );
    snapshotMutationQueue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

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
    return (await ensureSnapshotCache())?.stored.snapshot ?? null;
  }

  async function getCachedTicket(eventId: string, ticketId: string) {
    const cached = await ensureSnapshotCache();
    if (!cached || cached.stored.eventId !== eventId) return undefined;
    return cached.ticketsById.get(ticketId);
  }

  async function getCachedTicketByCode(eventId: string, ticketCode: string) {
    const cached = await ensureSnapshotCache();
    if (!cached || cached.stored.eventId !== eventId) return undefined;
    return cached.ticketsByCode.get(ticketCode);
  }

  async function countPendingScanAttempts(eventId: string) {
    return database.pendingScanAttempts.where("eventId").equals(eventId).count();
  }

  async function cacheSnapshot(
    snapshot: OfflineEventSnapshot,
    options: { replaceExisting?: boolean } = {},
  ) {
    await enqueueSnapshotMutation(async () => {
      await ensureSnapshotCache();
      const cached = await database.transaction(
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
          const stored: StoredSnapshot = {
            eventId: snapshot.event.id,
            snapshot,
            performanceTimeOrigin: performance.timeOrigin,
            performanceNow: performance.now(),
          };
          await database.snapshots.put(stored);
          return {
            stored,
            locallyAcceptedTicketIds: await readLocallyAcceptedTicketIds(
              snapshot.event.id,
            ),
          };
        },
      );
      snapshotCache = createSnapshotCache(
        cached.stored,
        cached.locallyAcceptedTicketIds,
      );
      snapshotCacheLoaded = true;
    });
  }

  async function captureAttemptTiming(eventId: string) {
    const cached = await ensureSnapshotCache();
    if (!cached || cached.stored.eventId !== eventId) return null;
    const stored = cached.stored;
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
    await enqueueSnapshotMutation(async () => {
      await ensureSnapshotCache();
      await database.pendingScanAttempts.put(attempt);
      if (
        attempt.capturedOutcome === "provisional" &&
        attempt.ticketId &&
        snapshotCache?.stored.eventId === attempt.eventId
      ) {
        snapshotCache.locallyAcceptedTicketIds.add(attempt.ticketId);
      }
    });
  }

  async function hasLocallyAcceptedTicket(eventId: string, ticketId: string) {
    const cached = await ensureSnapshotCache();
    return (
      cached?.stored.eventId === eventId &&
      cached.locallyAcceptedTicketIds.has(ticketId)
    );
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
    await enqueueSnapshotMutation(async () => {
      await ensureSnapshotCache();
      const acknowledgment = await database.transaction(
        "rw",
        database.snapshots,
        database.pendingScanAttempts,
        async () => {
          const stored = await database.snapshots.get(eventId);
          if (stored) {
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
          return {
            stored,
            locallyAcceptedTicketIds: await readLocallyAcceptedTicketIds(
              eventId,
            ),
          };
        },
      );

      const cached = snapshotCache;
      if (acknowledgment.stored && cached?.stored.eventId === eventId) {
        cached.stored.snapshot.tickets = cached.stored.snapshot.tickets.map(
          (ticket) => {
            if (!checkedInTicketIds.has(ticket.ticketId)) return ticket;
            const updatedTicket = {
              ...ticket,
              existingCheckInState: "checked_in" as const,
            };
            cached.ticketsById.set(ticket.ticketId, updatedTicket);
            cached.ticketsByCode.set(ticket.ticketCode, updatedTicket);
            return updatedTicket;
          },
        );
        cached.locallyAcceptedTicketIds =
          acknowledgment.locallyAcceptedTicketIds;
      }
    });
  }

  async function countAllPendingScanAttempts() {
    return database.pendingScanAttempts.count();
  }

  async function purgeEventIfClosedAndAcknowledged(
    eventId: string,
    checkInClosesAt: string,
    now = new Date(),
  ) {
    return enqueueSnapshotMutation(async () => {
      const isClosed = now.getTime() >= new Date(checkInClosesAt).getTime();
      const pendingCount = await countPendingScanAttempts(eventId);
      if (isClosed && pendingCount === 0) {
        const cached = await database.snapshots.get(eventId);
        if (cached) {
          await database.snapshots.delete(eventId);
          if (snapshotCache?.stored.eventId === eventId) {
            snapshotCache = null;
            snapshotCacheLoaded = true;
          }
          return true;
        }
        if (snapshotCache?.stored.eventId === eventId) {
          snapshotCache = null;
          snapshotCacheLoaded = true;
        }
      }
      return false;
    });
  }

  function close() {
    snapshotCache = null;
    snapshotCacheLoaded = false;
    database.close();
  }

  return {
    getOrCreateScannerDevice,
    updateScannerDeviceLabel,
    getCachedSnapshot,
    getCachedTicket,
    getCachedTicketByCode,
    cacheSnapshot,
    captureAttemptTiming,
    countPendingScanAttempts,
    countAllPendingScanAttempts,
    purgeEventIfClosedAndAcknowledged,
    savePendingScanAttempt,
    hasLocallyAcceptedTicket,
    listPendingScanAttempts,
    acknowledgeScanAttempts,
    close,
  };
}

export const offlineScannerStore = createOfflineScannerStore();
