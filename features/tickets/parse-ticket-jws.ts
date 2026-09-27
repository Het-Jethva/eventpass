import { decodeCanonicalBase64Url } from "@/lib/base64url";
import { isRecord } from "@/lib/is-record";

export const TICKET_PROTOCOL_VERSION = 1 as const;
export const TICKET_JWS_TYPE = "eventpass-ticket+jws";

export type TicketPayload = {
  v: typeof TICKET_PROTOCOL_VERSION;
  eventId: string;
  ticketId: string;
};

export type TicketProtectedHeader = {
  alg: "ES256";
  kid: string;
  typ: typeof TICKET_JWS_TYPE;
};

export type ParsedTicketJws = {
  header: TicketProtectedHeader;
  payload: TicketPayload;
  signingInput: string;
  signatureSegment: string;
};

function hasExactKeys(value: object, expected: readonly string[]) {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

function parseProtectedHeader(value: unknown): TicketProtectedHeader {
  if (!isRecord(value) || !hasExactKeys(value, ["alg", "kid", "typ"])) {
    throw new Error("Unsupported Ticket header.");
  }
  const { alg, kid, typ } = value;
  if (alg !== "ES256" || typeof kid !== "string" || kid.length === 0 || typ !== TICKET_JWS_TYPE) {
    throw new Error("Unsupported Ticket header.");
  }
  return { alg, kid, typ };
}

function parsePayload(value: unknown): TicketPayload {
  if (!isRecord(value) || !hasExactKeys(value, ["eventId", "ticketId", "v"])) {
    throw new Error("Unsupported Ticket payload.");
  }
  const { eventId, ticketId, v } = value;
  if (
    v !== TICKET_PROTOCOL_VERSION ||
    typeof eventId !== "string" ||
    eventId.length === 0 ||
    typeof ticketId !== "string" ||
    ticketId.length === 0
  ) {
    throw new Error("Unsupported Ticket payload.");
  }
  return { v, eventId, ticketId };
}

function jsonSegment(segment: string): unknown {
  return JSON.parse(new TextDecoder().decode(decodeCanonicalBase64Url(segment)));
}

/**
 * Structural parse shared by the Node verifier and the browser verifier.
 * The signature segment stays encoded so the server can report an unknown
 * key before it judges the signature. `atob` accepts padding bits that
 * decodeTicketSignature rejects.
 */
export function parseTicketJws(compactJws: string): ParsedTicketJws {
  const segments = compactJws.split(".");
  if (segments.length !== 3) throw new Error("Malformed JWS.");
  const [protectedSegment, payloadSegment, signatureSegment] = segments;
  if (!protectedSegment || !payloadSegment || !signatureSegment) {
    throw new Error("Malformed JWS.");
  }
  return {
    header: parseProtectedHeader(jsonSegment(protectedSegment)),
    payload: parsePayload(jsonSegment(payloadSegment)),
    signingInput: `${protectedSegment}.${payloadSegment}`,
    signatureSegment,
  };
}

export function decodeTicketSignature(signatureSegment: string) {
  const signature = decodeCanonicalBase64Url(signatureSegment);
  if (signature.length !== 64) throw new Error("Malformed JWS signature.");
  return signature;
}
