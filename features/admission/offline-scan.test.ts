import "fake-indexeddb/auto";

import { createHash, generateKeyPairSync, randomUUID } from "node:crypto";

import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";

import { signTicket } from "../tickets/ticket-crypto";
import { admitOffline, verifyOfflineTicket } from "./offline-scan";
import type { OfflineEventSnapshot } from "./offline-snapshot";
import { createOfflineScannerStore } from "./offline-snapshot-store";

const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "P-256",
});

const stores: Array<{
  name: string;
  store: ReturnType<typeof createOfflineScannerStore>;
}> = [];

function createStore() {
  const name = `eventpass-offline-scan-${randomUUID()}`;
  const store = createOfflineScannerStore(name);
  stores.push({ name, store });
  return store;
}

function snapshotForScan(ticket: {
  ticketId: string;
  ticketCode: string;
}): OfflineEventSnapshot {
  const eventId = randomUUID();
  return {
    version: 1,
    generatedAt: "2030-01-02T10:30:00.000Z",
    serverTimeAnchor: "2030-01-02T10:30:00.000Z",
    event: {
      id: eventId,
      name: "Offline Ticket Code gate",
      status: "published",
      eventTimeZone: "UTC",
      checkInOpensAt: "2030-01-02T10:00:00.000Z",
      checkInClosesAt: "2030-01-02T14:00:00.000Z",
      snapshotFreshAfter: "2030-01-02T08:00:00.000Z",
    },
    scannerDevice: { id: randomUUID(), label: "Main entrance phone" },
    authorization: "signed.authorization.value",
    verificationKeys: {
      "offline-test-key": publicKey.export({ format: "jwk" }),
    },
    tickets: [
      {
        ticketId: ticket.ticketId,
        ticketCode: ticket.ticketCode,
        displayName: "Ada Lovelace",
        validityState: "active",
        existingCheckInState: "not_checked_in",
      },
    ],
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

describe("offline Ticket verification", () => {
  it("verifies an ES256 Ticket locally and rejects a changed payload", async () => {
    const payload = { eventId: randomUUID(), ticketId: randomUUID() };
    const signedTicket = signTicket(payload, {
      id: "offline-test-key",
      privateKey,
    });
    const keys = {
      "offline-test-key": publicKey.export({ format: "jwk" }),
    };

    await expect(verifyOfflineTicket(signedTicket, keys)).resolves.toEqual(
      payload,
    );

    const segments = signedTicket.split(".");
    const changedPayload = JSON.parse(
      Buffer.from(segments[1]!, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    changedPayload.ticketId = randomUUID();
    segments[1] = Buffer.from(JSON.stringify(changedPayload), "utf8").toString(
      "base64url",
    );
    await expect(
      verifyOfflineTicket(segments.join("."), keys),
    ).resolves.toBeNull();
  });
});

describe("offline Ticket Code admission", () => {
  it("admits a snapshot Ticket Code and queues a digest the server can verify", async () => {
    const store = createStore();
    const ticketId = randomUUID();
    const eventSnapshot = snapshotForScan({
      ticketId,
      ticketCode: "ABCDEFGHJK",
    });
    await store.cacheSnapshot(eventSnapshot);

    const result = await admitOffline(
      {
        eventId: eventSnapshot.event.id,
        input: "abcde-fghjk",
        inputMethod: "manual",
      },
      store,
    );

    expect(result).toEqual({
      outcome: "provisional",
      attendeeName: "Ada Lovelace",
    });
    const [attempt] = await store.listPendingScanAttempts(
      eventSnapshot.event.id,
    );
    expect(attempt).toMatchObject({
      ticketId,
      signedTicket: null,
      capturedOutcome: "provisional",
      inputDigest: createHash("sha256").update("ABCDEFGHJK").digest("hex"),
    });
  });

  it("treats an unknown Ticket Code as unknown rather than an invalid JWS", async () => {
    const store = createStore();
    const eventSnapshot = snapshotForScan({
      ticketId: randomUUID(),
      ticketCode: "ABCDEFGHJK",
    });
    await store.cacheSnapshot(eventSnapshot);

    await expect(
      admitOffline(
        {
          eventId: eventSnapshot.event.id,
          input: "0123456789",
          inputMethod: "manual",
        },
        store,
      ),
    ).resolves.toEqual({ outcome: "unknown" });
  });
});
