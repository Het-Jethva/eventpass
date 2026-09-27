import {
  createPrivateKey,
  createPublicKey,
  sign as signBytes,
  verify as verifyBytes,
  type KeyObject,
} from "node:crypto";

import { encodeBase64Url } from "@/lib/base64url";

import {
  decodeTicketSignature,
  parseTicketJws,
  TICKET_JWS_TYPE,
  TICKET_PROTOCOL_VERSION,
  type TicketPayload,
  type TicketProtectedHeader,
} from "./parse-ticket-jws";

export { TICKET_JWS_TYPE, TICKET_PROTOCOL_VERSION };
export type { TicketPayload, TicketProtectedHeader };

function encodeJson(value: TicketPayload | TicketProtectedHeader) {
  return encodeBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function asPrivateKey(key: KeyObject | string | Buffer) {
  return typeof key === "string" || Buffer.isBuffer(key) ? createPrivateKey(key) : key;
}

function asPublicKey(key: KeyObject | string | Buffer) {
  return typeof key === "string" || Buffer.isBuffer(key) ? createPublicKey(key) : key;
}

export function signTicket(
  payload: Omit<TicketPayload, "v">,
  key: { id: string; privateKey: KeyObject | string | Buffer },
) {
  const header: TicketProtectedHeader = {
    alg: "ES256",
    kid: key.id,
    typ: TICKET_JWS_TYPE,
  };
  const completePayload: TicketPayload = { v: TICKET_PROTOCOL_VERSION, ...payload };
  const protectedSegment = encodeJson(header);
  const payloadSegment = encodeJson(completePayload);
  const signingInput = `${protectedSegment}.${payloadSegment}`;
  const signature = signBytes("sha256", Buffer.from(signingInput, "ascii"), {
    key: asPrivateKey(key.privateKey),
    dsaEncoding: "ieee-p1363",
  });
  return `${signingInput}.${encodeBase64Url(signature)}`;
}

export type TicketVerificationResult =
  | { valid: true; header: TicketProtectedHeader; payload: TicketPayload }
  | { valid: false; reason: "malformed" | "unknown_key" | "invalid_signature" };

export function verifyTicket(
  compactJws: string,
  publicKeys: Readonly<Record<string, KeyObject | string | Buffer>>,
): TicketVerificationResult {
  try {
    const parsed = parseTicketJws(compactJws);
    const publicKey = publicKeys[parsed.header.kid];
    if (!publicKey) return { valid: false, reason: "unknown_key" };
    const signature = decodeTicketSignature(parsed.signatureSegment);
    const valid = verifyBytes(
      "sha256",
      Buffer.from(parsed.signingInput, "ascii"),
      { key: asPublicKey(publicKey), dsaEncoding: "ieee-p1363" },
      Buffer.from(signature),
    );
    return valid
      ? { valid: true, header: parsed.header, payload: parsed.payload }
      : { valid: false, reason: "invalid_signature" };
  } catch {
    return { valid: false, reason: "malformed" };
  }
}
