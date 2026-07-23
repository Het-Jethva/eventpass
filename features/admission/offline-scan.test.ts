import { generateKeyPairSync, randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { signTicket } from "../tickets/ticket-crypto";
import { verifyOfflineTicket } from "./offline-scan";

const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "P-256",
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
