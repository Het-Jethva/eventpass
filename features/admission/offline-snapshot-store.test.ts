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
      ticketId: randomUUID(),
      inputDigest: "digest",
      inputMethod: "camera",
      capturedOutcome: "provisional",
      deviceRecordedAt: "2030-01-02T10:05:00.000Z",
      serverTimeAnchor: "2030-01-02T09:30:00.000Z",
      monotonicElapsedMs: 2_100_000,
      timestampConfidence: "high",
      signedTicket: "signed.ticket.value",
      authorization: "signed.authorization.value",
      scannerDeviceId: first.scannerDevice.id,
    });

    await expect(store.cacheSnapshot(second)).rejects.toEqual(
      new SnapshotReplacementRequiredError(first.event.id, first.event.name, 1),
    );

    await store.cacheSnapshot(second, { replaceExisting: true });
    expect(await store.getCachedSnapshot()).toEqual(second);
    expect(await store.countPendingScanAttempts(first.event.id)).toBe(1);
  });

  it("durably prevents a local duplicate and reconciles an acknowledged Check-in into the snapshot", async () => {
    const store = createStore();
    const eventSnapshot = snapshot(randomUUID(), "Offline gate test");
    const ticketId = randomUUID();
    eventSnapshot.tickets.push({
      ticketId,
      displayName: "Ada Lovelace",
      validityState: "active",
      existingCheckInState: "not_checked_in",
    });
    await store.cacheSnapshot(eventSnapshot);
    const attemptId = randomUUID();
    await store.savePendingScanAttempt({
      id: attemptId,
      eventId: eventSnapshot.event.id,
      ticketId,
      inputDigest: "a".repeat(64),
      inputMethod: "camera",
      capturedOutcome: "provisional",
      deviceRecordedAt: "2030-01-02T10:05:00.000Z",
      serverTimeAnchor: eventSnapshot.serverTimeAnchor,
      monotonicElapsedMs: 2_100_000,
      timestampConfidence: "high",
      signedTicket: "signed.ticket.value",
      authorization: eventSnapshot.authorization,
      scannerDeviceId: eventSnapshot.scannerDevice.id,
    });

    expect(
      await store.hasLocallyAcceptedTicket(eventSnapshot.event.id, ticketId),
    ).toBe(true);
    expect(await store.listPendingScanAttempts(eventSnapshot.event.id)).toHaveLength(
      1,
    );

    await store.acknowledgeScanAttempts(eventSnapshot.event.id, [
      { id: attemptId, ticketId, outcome: "accepted" },
    ]);

    expect(await store.countPendingScanAttempts(eventSnapshot.event.id)).toBe(0);
    expect((await store.getCachedSnapshot())?.tickets[0]).toMatchObject({
      ticketId,
      existingCheckInState: "checked_in",
    });
  });
});
