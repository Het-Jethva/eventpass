import {
  createPrivateKey,
  createPublicKey,
  sign as signBytes,
  verify as verifyBytes,
  type KeyObject,
} from "node:crypto";

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
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeJson(segment: string): unknown {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) {
    throw new Error("Malformed JWS segment.");
  }
  const decoded = Buffer.from(segment, "base64url");
  if (decoded.toString("base64url") !== segment) {
    throw new Error("Non-canonical JWS segment.");
  }
  return JSON.parse(decoded.toString("utf8"));
}

function hasExactKeys(value: object, expected: string[]) {
  const keys = Object.keys(value).sort();
  return (
    keys.length === expected.length &&
    keys.every((key, index) => key === expected[index])
  );
}

function parseHeader(value: unknown) {
  if (
    typeof value !== "object" ||
    value === null ||
    !hasExactKeys(value, ["alg", "kid", "typ", "v"]) ||
    !("alg" in value) ||
    value.alg !== "ES256" ||
    !("kid" in value) ||
    typeof value.kid !== "string" ||
    value.kid.length === 0 ||
    !("typ" in value) ||
    value.typ !== SCANNER_AUTHORIZATION_JWS_TYPE ||
    !("v" in value) ||
    value.v !== SCANNER_AUTHORIZATION_VERSION
  ) {
    throw new Error("Unsupported Scanner Authorization header.");
  }
  return value as ScannerAuthorizationProtectedHeader;
}

function parsePayload(value: unknown) {
  if (
    typeof value !== "object" ||
    value === null ||
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
  const record = value as Record<string, unknown>;
  for (const key of [
    "eventId",
    "expiresAt",
    "issuedAt",
    "scannerDeviceId",
    "volunteerUserId",
  ] as const) {
    if (
      !(key in record) ||
      typeof record[key] !== "string" ||
      !record[key]
    ) {
      throw new Error("Unsupported Scanner Authorization payload.");
    }
  }
  return value as ScannerAuthorizationPayload;
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
  return `${signingInput}.${signature.toString("base64url")}`;
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
    const signature = Buffer.from(signatureSegment, "base64url");
    if (
      signature.length !== 64 ||
      signature.toString("base64url") !== signatureSegment
    ) {
      return { valid: false, reason: "malformed" };
    }
    const valid = verifyBytes(
      "sha256",
      Buffer.from(`${protectedSegment}.${payloadSegment}`, "ascii"),
      { key: asPublicKey(publicKey), dsaEncoding: "ieee-p1363" },
      signature,
    );
    return valid
      ? { valid: true, payload }
      : { valid: false, reason: "invalid_signature" };
  } catch {
    return { valid: false, reason: "malformed" };
  }
}
