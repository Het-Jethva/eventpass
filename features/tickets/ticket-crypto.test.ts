import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it } from "vitest";

import { signTicket, TICKET_JWS_TYPE, verifyTicket } from "./ticket-crypto";

const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "P-256",
});

describe("Ticket cryptography", () => {
  it("signs a minimal ES256 Ticket and verifies it with the retained public key", () => {
    const compactJws = signTicket(
      { eventId: "event-opaque-id", ticketId: "ticket-opaque-id" },
      { id: "2026-07", privateKey },
    );

    const result = verifyTicket(compactJws, { "2026-07": publicKey });

    expect(result).toEqual({
      valid: true,
      header: { alg: "ES256", kid: "2026-07", typ: TICKET_JWS_TYPE },
      payload: { v: 1, eventId: "event-opaque-id", ticketId: "ticket-opaque-id" },
    });
  });

  it.each(["header", "payload", "signature"] as const)(
    "rejects a Ticket whose %s has been tampered with",
    (segmentName) => {
      const original = signTicket(
        { eventId: "event-opaque-id", ticketId: "ticket-opaque-id" },
        { id: "2026-07", privateKey },
      );
      const segments = original.split(".");
      const index = { header: 0, payload: 1, signature: 2 }[segmentName];
      const segment = segments[index]!;
      segments[index] = `${segment.slice(0, -1)}${segment.endsWith("A") ? "B" : "A"}`;

      expect(verifyTicket(segments.join("."), { "2026-07": publicKey }).valid).toBe(false);
    },
  );

  it("rejects a valid signature from an unknown signing-key version", () => {
    const compactJws = signTicket(
      { eventId: "event-opaque-id", ticketId: "ticket-opaque-id" },
      { id: "retired-key", privateKey },
    );

    expect(verifyTicket(compactJws, {})).toEqual({ valid: false, reason: "unknown_key" });
  });
});
