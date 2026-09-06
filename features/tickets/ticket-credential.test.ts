import { describe, expect, it } from "vitest";

import { signTicket } from "./ticket-crypto";
import { classifyTicketCredential } from "./ticket-credential";
import { formatTicketCode } from "./ticket-code";
import { generateKeyPairSync } from "node:crypto";

const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const signingKey = { id: "test-key", privateKey };

describe("classifyTicketCredential", () => {
  it("routes a Ticket Code to the code path", () => {
    const code = "0123456789";
    expect(classifyTicketCredential(code)).toEqual({ kind: "code", code });
  });

  it("routes a grouped, lowercased code to the canonical code path", () => {
    expect(classifyTicketCredential("01234-56789".toLowerCase())).toEqual({
      kind: "code",
      code: "0123456789",
    });
    expect(formatTicketCode("0123456789")).toBe("01234-56789");
  });

  it("routes a signed Ticket to the JWS path, never the code path", () => {
    const jws = signTicket(
      { eventId: "11111111-1111-1111-1111-111111111111", ticketId: "22222222-2222-2222-2222-222222222222" },
      signingKey,
    );
    expect(classifyTicketCredential(jws)).toEqual({ kind: "jws", jws });
  });

  it("routes garbage and partial JWS input to the JWS path for the verifier to refuse", () => {
    expect(classifyTicketCredential("not-a-ticket").kind).toBe("jws");
    expect(classifyTicketCredential("abc.def").kind).toBe("jws");
    expect(classifyTicketCredential("").kind).toBe("jws");
  });

  it("never mistakes a 10-character non-code for a Ticket Code", () => {
    expect(classifyTicketCredential("IIIIIIIIII").kind).toBe("jws");
    expect(classifyTicketCredential("0123456789!").kind).toBe("jws");
  });
});
