import { generateKeyPairSync, randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  signScannerAuthorization,
  verifyScannerAuthorization,
} from "./scanner-authorization";

const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "P-256",
});

describe("Scanner Authorization", () => {
  it("binds a signed capability to one Event, volunteer, device, and Check-in Window", () => {
    const payload = {
      eventId: randomUUID(),
      volunteerUserId: randomUUID(),
      scannerDeviceId: randomUUID(),
      issuedAt: "2030-01-02T09:00:00.000Z",
      expiresAt: "2030-01-02T14:00:00.000Z",
    };

    const authorization = signScannerAuthorization(payload, {
      id: "integration-key",
      privateKey,
    });

    expect(
      verifyScannerAuthorization(authorization, {
        "integration-key": publicKey,
      }),
    ).toEqual({ valid: true, payload });
  });

  it("rejects a changed Scanner Authorization payload", () => {
    const authorization = signScannerAuthorization(
      {
        eventId: randomUUID(),
        volunteerUserId: randomUUID(),
        scannerDeviceId: randomUUID(),
        issuedAt: "2030-01-02T09:00:00.000Z",
        expiresAt: "2030-01-02T14:00:00.000Z",
      },
      { id: "integration-key", privateKey },
    );
    const segments = authorization.split(".");
    const payload = JSON.parse(
      Buffer.from(segments[1]!, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    payload.scannerDeviceId = randomUUID();
    segments[1] = Buffer.from(JSON.stringify(payload), "utf8").toString(
      "base64url",
    );

    expect(
      verifyScannerAuthorization(segments.join("."), {
        "integration-key": publicKey,
      }),
    ).toEqual({ valid: false, reason: "invalid_signature" });
  });
});
