import {
  createPrivateKey,
  createPublicKey,
  sign as signBytes,
  verify as verifyBytes,
  type KeyObject,
} from "node:crypto";

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

function encodeJson(value: TicketPayload | TicketProtectedHeader) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function asPrivateKey(key: KeyObject | string | Buffer) {
  return typeof key === "string" || Buffer.isBuffer(key) ? createPrivateKey(key) : key;
}

function asPublicKey(key: KeyObject | string | Buffer) {
  return typeof key === "string" || Buffer.isBuffer(key) ? createPublicKey(key) : key;
}

function decodeSegment(segment: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) throw new Error("Malformed JWS segment.");
  const decoded = Buffer.from(segment, "base64url");
  if (decoded.toString("base64url") !== segment) throw new Error("Non-canonical JWS segment.");
  return decoded;
}

function hasExactKeys(value: object, expected: string[]) {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

function parseProtectedHeader(segment: string): TicketProtectedHeader {
  const value: unknown = JSON.parse(decodeSegment(segment).toString("utf8"));
  if (
    typeof value !== "object" ||
    value === null ||
    !hasExactKeys(value, ["alg", "kid", "typ"]) ||
    !("alg" in value) ||
    value.alg !== "ES256" ||
    !("kid" in value) ||
    typeof value.kid !== "string" ||
    value.kid.length === 0 ||
    !("typ" in value) ||
    value.typ !== TICKET_JWS_TYPE
  ) {
    throw new Error("Unsupported Ticket header.");
  }
  return value as TicketProtectedHeader;
}

function parsePayload(segment: string): TicketPayload {
  const value: unknown = JSON.parse(decodeSegment(segment).toString("utf8"));
  if (
    typeof value !== "object" ||
    value === null ||
    !hasExactKeys(value, ["eventId", "ticketId", "v"]) ||
    !("v" in value) ||
    value.v !== TICKET_PROTOCOL_VERSION ||
    !("eventId" in value) ||
    typeof value.eventId !== "string" ||
    value.eventId.length === 0 ||
    !("ticketId" in value) ||
    typeof value.ticketId !== "string" ||
    value.ticketId.length === 0
  ) {
    throw new Error("Unsupported Ticket payload.");
  }
  return value as TicketPayload;
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
  return `${signingInput}.${signature.toString("base64url")}`;
}

export type TicketVerificationResult =
  | { valid: true; header: TicketProtectedHeader; payload: TicketPayload }
  | { valid: false; reason: "malformed" | "unknown_key" | "invalid_signature" };

export function verifyTicket(
  compactJws: string,
  publicKeys: Readonly<Record<string, KeyObject | string | Buffer>>,
): TicketVerificationResult {
  try {
    const segments = compactJws.split(".");
    if (segments.length !== 3) return { valid: false, reason: "malformed" };
    const [protectedSegment, payloadSegment, signatureSegment] = segments;
    if (!protectedSegment || !payloadSegment || !signatureSegment) {
      return { valid: false, reason: "malformed" };
    }
    const header = parseProtectedHeader(protectedSegment);
    const payload = parsePayload(payloadSegment);
    const publicKey = publicKeys[header.kid];
    if (!publicKey) return { valid: false, reason: "unknown_key" };
    const signature = decodeSegment(signatureSegment);
    if (signature.length !== 64) return { valid: false, reason: "malformed" };
    const valid = verifyBytes(
      "sha256",
      Buffer.from(`${protectedSegment}.${payloadSegment}`, "ascii"),
      { key: asPublicKey(publicKey), dsaEncoding: "ieee-p1363" },
      signature,
    );
    return valid
      ? { valid: true, header, payload }
      : { valid: false, reason: "invalid_signature" };
  } catch {
    return { valid: false, reason: "malformed" };
  }
}
