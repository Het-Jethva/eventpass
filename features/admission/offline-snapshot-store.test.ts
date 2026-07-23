import "fake-indexeddb/auto";

import { randomUUID } from "node:crypto";

import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";

import type { OfflineEventSnapshot } from "./offline-snapshot";
import {
  SnapshotReplacementRequiredError,
  createOfflineScannerStore,
} from "./offline-snapshot-store";

const stores: Array<{
  name: string;
  store: ReturnType<typeof createOfflineScannerStore>;
}> = [];

function createStore() {
  const name = `eventpass-test-${randomUUID()}`;
  const store = createOfflineScannerStore(name);
  stores.push({ name, store });
  return store;
}

function snapshot(eventId: string, name: string): OfflineEventSnapshot {
  return {
    version: 1,
    generatedAt: "2030-01-02T09:30:00.000Z",
    serverTimeAnchor: "2030-01-02T09:30:00.000Z",
    event: {
      id: eventId,
      name,
      status: "published",
      eventTimeZone: "UTC",
      checkInOpensAt: "2030-01-02T10:00:00.000Z",
      checkInClosesAt: "2030-01-02T14:00:00.000Z",
      snapshotFreshAfter: "2030-01-02T08:00:00.000Z",
    },
    scannerDevice: { id: randomUUID(), label: "Main entrance phone" },
    authorization: "signed.authorization.value",
    verificationKeys: {},
    tickets: [],
  };
}

afterEach(async () => {
  await Promise.all(
    stores.splice(0).map(async ({ name, store }) => {
      store.close();
      await Dexie.delete(name);
    }),
  );
});

describe("Offline scanner store", () => {
  it("keeps one random Scanner Device UUID for the browser profile", async () => {
    const store = createStore();

    const first = await store.getOrCreateScannerDevice();
    const second = await store.getOrCreateScannerDevice();

    expect(first.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(second).toEqual(first);
  });

  it("requires confirmation to replace another Event and preserves pending Scan Attempts", async () => {
    const store = createStore();
    const first = snapshot(randomUUID(), "Engineering social");
    const second = snapshot(randomUUID(), "Robotics showcase");
    await store.cacheSnapshot(first);
    await store.savePendingScanAttempt({
      id: randomUUID(),
      eventId: first.event.id,
      recordedAt: "2030-01-02T10:05:00.000Z",
    });

    await expect(store.cacheSnapshot(second)).rejects.toEqual(
      new SnapshotReplacementRequiredError(first.event.id, first.event.name, 1),
    );

    await store.cacheSnapshot(second, { replaceExisting: true });
    expect(await store.getCachedSnapshot()).toEqual(second);
    expect(await store.countPendingScanAttempts(first.event.id)).toBe(1);
  });
});
