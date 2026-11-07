import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";

import type { OfflineScanAttemptInput } from "@/features/admission/admission";
import { signScannerAuthorization } from "@/features/admission/scanner-authorization";

test("a signed scanner authorization cannot admit attempts at or after its expiry", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });
  process.env.DATABASE_URL = "postgresql://unused:unused@localhost:5432/unused";
  process.env.TICKET_PUBLIC_KEYS_JSON = JSON.stringify({
    test: publicKey.export({ format: "pem", type: "spki" }).toString(),
  });
  const { synchronizeOfflineAttempts } =
    await import("@/features/admission/server/offline-synchronization");
  const eventId = "00000000-0000-4000-8000-000000000001";
  const scannerDeviceId = "00000000-0000-4000-8000-000000000002";
  const issuedAt = "2030-01-01T10:00:00.000Z";
  const authorization = signScannerAuthorization(
    {
      eventId,
      scannerDeviceId,
      volunteerUserId: "00000000-0000-4000-8000-000000000003",
      issuedAt,
      expiresAt: "2030-01-01T11:00:00.000Z",
    },
    { id: "test", privateKey },
  );

  for (const elapsed of [60 * 60_000, 60 * 60_000 + 1]) {
    const attempt: OfflineScanAttemptInput = {
      id: "00000000-0000-4000-8000-000000000004",
      eventId,
      scannerDeviceId,
      ticketId: null,
      signedTicket: null,
      inputDigest: "unrecognized-code",
      inputMethod: "manual",
      capturedOutcome: "unknown",
      deviceRecordedAt: new Date(
        new Date(issuedAt).getTime() + elapsed,
      ).toISOString(),
      serverTimeAnchor: issuedAt,
      monotonicElapsedMs: elapsed,
      timestampConfidence: "high",
    };
    assert.deepEqual(
      await synchronizeOfflineAttempts({ authorization, attempts: [attempt] }),
      {
        outcome: "unauthorized",
        results: [],
      },
    );
  }
});
