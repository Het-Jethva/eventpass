import {
  createPrivateKey,
  createPublicKey,
  sign as signBytes,
  verify as verifyBytes,
  type KeyObject,
} from "node:crypto";

import { decodeCanonicalBase64Url, encodeBase64Url } from "@/lib/base64url";
import { isRecord } from "@/lib/is-record";

export const SCANNER_AUTHORIZATION_VERSION = 1 as const;
export const SCANNER_AUTHORIZATION_JWS_TYPE =
  "eventpass-scanner-authorization+jws";

export type ScannerAuthorizationPayload = {
  eventId: string;
  volunteerUserId: string;
  scannerDeviceId: string;
  issuedAt: string;
  expiresAt: string;
};

type ScannerAuthorizationProtectedHeader = {
  alg: "ES256";
  kid: string;
  typ: typeof SCANNER_AUTHORIZATION_JWS_TYPE;
  v: typeof SCANNER_AUTHORIZATION_VERSION;
};

type SigningKey = {
  id: string;
  privateKey: KeyObject | string | Buffer;
};

type VerificationKey = KeyObject | string | Buffer;

function asPrivateKey(key: SigningKey["privateKey"]) {
  return typeof key === "string" || Buffer.isBuffer(key)
    ? createPrivateKey(key)
    : key;
}

function asPublicKey(key: VerificationKey) {
  return typeof key === "string" || Buffer.isBuffer(key)
    ? createPublicKey(key)
    : key;
}

function encodeJson(value: object) {
  return encodeBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function decodeJson(segment: string): unknown {
  return JSON.parse(new TextDecoder().decode(decodeCanonicalBase64Url(segment)));
}

function hasExactKeys(value: object, expected: string[]) {
  const keys = Object.keys(value).sort();
  return (
    keys.length === expected.length &&
    keys.every((key, index) => key === expected[index])
  );
}

function parseHeader(value: unknown): ScannerAuthorizationProtectedHeader {
  if (!isRecord(value) || !hasExactKeys(value, ["alg", "kid", "typ", "v"])) {
    throw new Error("Unsupported Scanner Authorization header.");
  }
  const { alg, kid, typ, v } = value;
  if (
    alg !== "ES256" ||
    typeof kid !== "string" ||
    kid.length === 0 ||
    typ !== SCANNER_AUTHORIZATION_JWS_TYPE ||
    v !== SCANNER_AUTHORIZATION_VERSION
  ) {
    throw new Error("Unsupported Scanner Authorization header.");
  }
  return { alg, kid, typ, v };
}

function parsePayload(value: unknown): ScannerAuthorizationPayload {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "eventId",
      "expiresAt",
      "issuedAt",
      "scannerDeviceId",
      "volunteerUserId",
    ])
  ) {
    throw new Error("Unsupported Scanner Authorization payload.");
  }
  const { eventId, expiresAt, issuedAt, scannerDeviceId, volunteerUserId } = value;
  if (
    typeof eventId !== "string" ||
    eventId.length === 0 ||
    typeof expiresAt !== "string" ||
    expiresAt.length === 0 ||
    typeof issuedAt !== "string" ||
    issuedAt.length === 0 ||
    typeof scannerDeviceId !== "string" ||
    scannerDeviceId.length === 0 ||
    typeof volunteerUserId !== "string" ||
    volunteerUserId.length === 0
  ) {
    throw new Error("Unsupported Scanner Authorization payload.");
  }
  return { eventId, volunteerUserId, scannerDeviceId, issuedAt, expiresAt };
}

export function signScannerAuthorization(
  payload: ScannerAuthorizationPayload,
  key: SigningKey,
) {
  const header: ScannerAuthorizationProtectedHeader = {
    alg: "ES256",
    kid: key.id,
    typ: SCANNER_AUTHORIZATION_JWS_TYPE,
    v: SCANNER_AUTHORIZATION_VERSION,
  };
  const protectedSegment = encodeJson(header);
  const payloadSegment = encodeJson(payload);
  const signingInput = `${protectedSegment}.${payloadSegment}`;
  const signature = signBytes("sha256", Buffer.from(signingInput, "ascii"), {
    key: asPrivateKey(key.privateKey),
    dsaEncoding: "ieee-p1363",
  });
  return `${signingInput}.${encodeBase64Url(signature)}`;
}

export type ScannerAuthorizationVerificationResult =
  | { valid: true; payload: ScannerAuthorizationPayload }
  | { valid: false; reason: "malformed" | "unknown_key" | "invalid_signature" };

export function verifyScannerAuthorization(
  compactJws: string,
  publicKeys: Readonly<Record<string, VerificationKey>>,
): ScannerAuthorizationVerificationResult {
  try {
    const segments = compactJws.split(".");
    if (segments.length !== 3) return { valid: false, reason: "malformed" };
    const [protectedSegment, payloadSegment, signatureSegment] = segments;
    if (!protectedSegment || !payloadSegment || !signatureSegment) {
      return { valid: false, reason: "malformed" };
    }
    const header = parseHeader(decodeJson(protectedSegment));
    const payload = parsePayload(decodeJson(payloadSegment));
    const publicKey = publicKeys[header.kid];
    if (!publicKey) return { valid: false, reason: "unknown_key" };
    const signature = decodeCanonicalBase64Url(signatureSegment);
    if (signature.length !== 64) return { valid: false, reason: "malformed" };
    const valid = verifyBytes(
      "sha256",
      Buffer.from(`${protectedSegment}.${payloadSegment}`, "ascii"),
      { key: asPublicKey(publicKey), dsaEncoding: "ieee-p1363" },
      Buffer.from(signature),
    );
    return valid
      ? { valid: true, payload }
      : { valid: false, reason: "invalid_signature" };
  } catch {
    return { valid: false, reason: "malformed" };
  }
}
