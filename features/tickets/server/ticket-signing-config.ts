import "server-only";

import { createPrivateKey, createPublicKey, type JsonWebKey } from "node:crypto";

function restorePem(value: string) {
  return value.replace(/\\n/g, "\n");
}

function readPublicKeyRing() {
  const value = process.env.TICKET_PUBLIC_KEYS_JSON;
  if (!value) throw new Error("TICKET_PUBLIC_KEYS_JSON is required to verify Tickets.");
  const parsed: unknown = JSON.parse(value);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("TICKET_PUBLIC_KEYS_JSON must be an object keyed by signing key ID.");
  }
  const keys: Record<string, string> = {};
  for (const [id, publicKey] of Object.entries(parsed)) {
    if (!id || typeof publicKey !== "string" || !publicKey) {
      throw new Error("Every Ticket public key requires a key ID and PEM value.");
    }
    keys[id] = restorePem(publicKey);
  }
  return keys;
}

export function getActiveTicketSigningKey() {
  const id = process.env.TICKET_SIGNING_KEY_ID;
  const privateKeyPem = process.env.TICKET_SIGNING_PRIVATE_KEY_PEM;
  if (!id || !privateKeyPem) {
    throw new Error(
      "TICKET_SIGNING_KEY_ID and TICKET_SIGNING_PRIVATE_KEY_PEM are required to issue Tickets.",
    );
  }
  const publicKeys = readPublicKeyRing();
  if (!publicKeys[id]) throw new Error("The active Ticket signing key needs a retained public key.");
  return { id, privateKey: createPrivateKey(restorePem(privateKeyPem)) };
}

export function getTicketVerificationKeys(): Record<string, JsonWebKey> {
  return Object.fromEntries(
    Object.entries(readPublicKeyRing()).map(([id, publicKey]) => [
      id,
      createPublicKey(publicKey).export({ format: "jwk" }),
    ]),
  );
}
