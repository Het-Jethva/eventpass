import "fake-indexeddb/auto";

import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import Dexie from "dexie";

import type { OfflineScanAttemptInput } from "@/features/admission/admission";
import { admitOffline } from "@/features/admission/offline-scan";
import { createOfflineScannerStore } from "@/features/admission/offline-snapshot-store";
import type { OfflineEventSnapshot } from "@/features/admission/offline-snapshot";
import { signTicket } from "@/features/tickets/ticket-crypto";

const eventId = "cfa9b9c1-3e5c-4c2d-a39b-98c3b79e9432";
const ticketId = "883cb70a-0067-4c68-b9b6-c69c5a9f8e1c";
const ticketCode = "7QM4XK3B9T";

function snapshot(): OfflineEventSnapshot {
  const now = Date.now();
  return {
    version: 1,
    generatedAt: new Date(now).toISOString(),
    serverTimeAnchor: new Date(now).toISOString(),
    event: {
      id: eventId,
      name: "Test event",
      status: "published",
      eventTimeZone: "UTC",
      checkInOpensAt: new Date(now - 60_000).toISOString(),
      checkInClosesAt: new Date(now + 600_000).toISOString(),
      snapshotFreshAfter: new Date(now - 120_000).toISOString(),
    },
    scannerDevice: { id: crypto.randomUUID(), label: "Door one" },
    authorization: crypto.randomUUID(),
    verificationKeys: {},
    tickets: [
      {
        ticketId,
        ticketCode,
        displayName: "Guest",
        validityState: "active",
        existingCheckInState: "not_checked_in",
      },
    ],
  };
}

test("independent scanner tabs claim once, replay safely, and observe authoritative changes", async (t) => {
  const name = `offline-scanner-${crypto.randomUUID()}`;
  const first = createOfflineScannerStore(name);
  const second = createOfflineScannerStore(name);
  t.after(async () => {
    first.close();
    second.close();
    await Dexie.delete(name);
  });
  const prepared = snapshot();
  await first.cacheSnapshot(prepared);
  const scans = [
    {
      eventId,
      clientAttemptId: crypto.randomUUID(),
      input: ticketCode,
      inputMethod: "manual",
    },
    {
      eventId,
      clientAttemptId: crypto.randomUUID(),
      input: ticketCode,
      inputMethod: "manual",
    },
  ] as const;
  const results = await Promise.all([
    admitOffline(scans[0], first),
    admitOffline(scans[1], second),
  ]);
  assert.deepEqual(results.map(({ outcome }) => outcome).sort(), [
    "duplicate",
    "provisional",
  ]);
  assert.equal(await first.countPendingScanAttempts(eventId), 2);
  assert.deepEqual(await admitOffline(scans[0], second), results[0]);
  assert.equal(
    (await admitOffline({ ...scans[0], input: "1111111111" }, first)).outcome,
    "invalid",
  );
  assert.equal(await first.countPendingScanAttempts(eventId), 2);
  assert.equal(
    await first.purgeEventIfClosedAndAcknowledged(
      eventId,
      new Date(Date.now() + 900_000),
    ),
    false,
  );

  for (const outcomes of [
    ["conflict", "duplicate"],
    ["duplicate", "conflict"],
  ] as const) {
    await second.applyAdmissionResults(
      eventId,
      outcomes.map((outcome) => ({ ticketId, outcome })),
    );
    assert.equal(
      (
        await admitOffline(
          { ...scans[0], clientAttemptId: crypto.randomUUID() },
          first,
        )
      ).outcome,
      "conflict",
    );
  }

  await second.applyAdmissionResults(
    eventId,
    [{ ticketId, outcome: "canceled" }],
    scans.map(({ clientAttemptId }) => clientAttemptId),
  );
  assert.equal(
    (
      await admitOffline(
        { ...scans[0], clientAttemptId: crypto.randomUUID() },
        first,
      )
    ).outcome,
    "canceled",
  );
  assert.equal(
    (await first.getCachedSnapshot())?.tickets[0]?.validityState,
    "canceled",
  );
});

test("snapshot replacement during signature verification cannot claim against stale keys", async (t) => {
  const name = `offline-scanner-${crypto.randomUUID()}`;
  const store = createOfflineScannerStore(name);
  t.after(async () => {
    store.close();
    await Dexie.delete(name);
  });
  const oldKeys = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const newKeys = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const oldSnapshot = snapshot();
  oldSnapshot.verificationKeys = {
    active: oldKeys.publicKey.export({ format: "jwk" }),
  };
  const newSnapshot = {
    ...oldSnapshot,
    authorization: crypto.randomUUID(),
    verificationKeys: { active: newKeys.publicKey.export({ format: "jwk" }) },
  };
  await store.cacheSnapshot(oldSnapshot);
  const signedTicket = signTicket(
    { eventId, ticketId },
    { id: "active", privateKey: oldKeys.privateKey },
  );
  let replaced = false;
  const result = await admitOffline(
    {
      eventId,
      clientAttemptId: crypto.randomUUID(),
      input: signedTicket,
      inputMethod: "camera",
    },
    {
      getVerificationContext: store.getVerificationContext,
      recordScan: async (input) => {
        if (!replaced) {
          replaced = true;
          await store.cacheSnapshot(newSnapshot);
        }
        return store.recordScan(input);
      },
    },
  );
  assert.equal(result.outcome, "invalid");
  const pending = await store.listPendingScanAttempts(eventId);
  assert.equal(pending.length, 1);
  assert.equal(pending[0]?.capturedOutcome, "invalid");
  assert.equal(pending[0]?.authorization, newSnapshot.authorization);
});

test("indexed ticket upgrade preserves existing snapshot and unsynced attempts", async (t) => {
  const name = `offline-scanner-${crypto.randomUUID()}`;
  const legacy = new Dexie(name);
  legacy.version(2).stores({
    scannerProfile: "&key",
    snapshots: "&eventId",
    pendingScanAttempts: "&id,eventId,[eventId+ticketId]",
  });
  const prepared = snapshot();
  const pending: OfflineScanAttemptInput & { authorization: string } = {
    id: crypto.randomUUID(),
    eventId,
    ticketId,
    inputDigest: "0".repeat(64),
    inputMethod: "manual",
    capturedOutcome: "provisional",
    deviceRecordedAt: prepared.generatedAt,
    serverTimeAnchor: prepared.serverTimeAnchor,
    monotonicElapsedMs: 0,
    timestampConfidence: "high",
    signedTicket: null,
    scannerDeviceId: prepared.scannerDevice.id,
    authorization: prepared.authorization,
  };
  await legacy.table("snapshots").put({
    eventId,
    snapshot: prepared,
    performanceTimeOrigin: performance.timeOrigin,
    performanceNow: performance.now(),
  });
  await legacy.table("pendingScanAttempts").put(pending);
  legacy.close();
  const store = createOfflineScannerStore(name);
  t.after(async () => {
    store.close();
    await Dexie.delete(name);
  });
  assert.deepEqual(await store.getCachedSnapshot(), prepared);
  assert.deepEqual(await store.listPendingScanAttempts(eventId), [pending]);
  const result = await admitOffline(
    {
      eventId,
      clientAttemptId: crypto.randomUUID(),
      input: ticketCode,
      inputMethod: "manual",
    },
    store,
  );
  assert.equal(result.outcome, "duplicate");
});
