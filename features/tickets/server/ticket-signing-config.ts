import "server-only";

import { createPrivateKey, createPublicKey, type KeyObject } from "node:crypto";
import { z } from "zod";

const publicKeyRingSchema = z.record(z.string().min(1), z.string().min(1));

let publicKeyCache:
  | {
      source: string;
      keys: Readonly<Record<string, KeyObject>>;
    }
  | undefined;
let signingKeyCache:
  | {
      id: string;
      pem: string;
      publicKey: KeyObject;
      signingKey: { id: string; privateKey: KeyObject };
    }
  | undefined;

function restorePem(value: string) {
  return value.replace(/\\n/g, "\n");
}

function assertP256(key: KeyObject) {
  if (
    key.asymmetricKeyType !== "ec" ||
    key.asymmetricKeyDetails?.namedCurve !== "prime256v1"
  ) {
    throw new Error(
      "Ticket keys must be ECDSA P-256 keys for ES256 signatures.",
    );
  }
}

export function getTicketVerificationKeyObjects() {
  const source = process.env.TICKET_PUBLIC_KEYS_JSON;
  if (!source) {
    throw new Error("TICKET_PUBLIC_KEYS_JSON is required to verify tickets.");
  }
  if (publicKeyCache?.source === source) return publicKeyCache.keys;

  let parsed: Record<string, string>;
  try {
    parsed = publicKeyRingSchema.parse(JSON.parse(source));
  } catch {
    throw new Error(
      "TICKET_PUBLIC_KEYS_JSON must map signing key IDs to PEM public keys.",
    );
  }
  if (Object.keys(parsed).length === 0) {
    throw new Error(
      "TICKET_PUBLIC_KEYS_JSON must contain at least one public key.",
    );
  }
  const keys = Object.fromEntries(
    Object.entries(parsed).map(([id, pem]) => {
      const key = createPublicKey(restorePem(pem));
      assertP256(key);
      return [id, key];
    }),
  );
  publicKeyCache = { source, keys: Object.freeze(keys) };
  return publicKeyCache.keys;
}

export function getActiveTicketSigningKey() {
  const id = process.env.TICKET_SIGNING_KEY_ID;
  const pem = process.env.TICKET_SIGNING_PRIVATE_KEY_PEM;
  if (!id || !pem) {
    throw new Error(
      "TICKET_SIGNING_KEY_ID and TICKET_SIGNING_PRIVATE_KEY_PEM are required to issue tickets.",
    );
  }
  const publicKey = getTicketVerificationKeyObjects()[id];
  if (!publicKey) {
    throw new Error(
      "The active ticket signing key needs a retained public key.",
    );
  }
  if (
    signingKeyCache?.id === id &&
    signingKeyCache.pem === pem &&
    signingKeyCache.publicKey === publicKey
  ) {
    return signingKeyCache.signingKey;
  }
  const privateKey = createPrivateKey(restorePem(pem));
  assertP256(privateKey);
  const derived = createPublicKey(privateKey).export({
    format: "der",
    type: "spki",
  });
  const retained = publicKey.export({ format: "der", type: "spki" });
  if (!derived.equals(retained)) {
    throw new Error(
      "The active ticket private key does not match its retained public key.",
    );
  }
  const signingKey = { id, privateKey };
  signingKeyCache = { id, pem, publicKey, signingKey };
  return signingKey;
}

export function getTicketVerificationKeys() {
  return Object.fromEntries(
    Object.entries(getTicketVerificationKeyObjects()).map(([id, key]) => [
      id,
      key.export({ format: "jwk" }),
    ]),
  );
}
