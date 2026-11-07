import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test, { type TestContext } from "node:test";

import {
  getActiveTicketSigningKey,
  getTicketVerificationKeyObjects,
  getTicketVerificationKeys,
} from "@/features/tickets/server/ticket-signing-config";
import { signTicket, verifyTicket } from "@/features/tickets/ticket-crypto";
import { verifyOfflineTicket } from "@/features/tickets/verify-offline-ticket";

function configureKeys(t: TestContext, curve = "prime256v1") {
  const names = [
    "TICKET_SIGNING_KEY_ID",
    "TICKET_SIGNING_PRIVATE_KEY_PEM",
    "TICKET_PUBLIC_KEYS_JSON",
  ];
  const previous = names.map((name) => [name, process.env[name]] as const);
  t.after(() => {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: curve,
  });
  process.env.TICKET_SIGNING_KEY_ID = "current";
  process.env.TICKET_SIGNING_PRIVATE_KEY_PEM = privateKey
    .export({ format: "pem", type: "pkcs8" })
    .toString();
  process.env.TICKET_PUBLIC_KEYS_JSON = JSON.stringify({
    current: publicKey.export({ format: "pem", type: "spki" }).toString(),
  });
}

test("configured tickets verify on the server and offline, including retained keys", async (t) => {
  configureKeys(t);
  const payload = { eventId: "event", ticketId: "ticket" };
  const signingKey = getActiveTicketSigningKey();
  assert.equal(getActiveTicketSigningKey(), signingKey);
  const token = signTicket(payload, signingKey);
  assert.equal(
    verifyTicket(token, getTicketVerificationKeyObjects()).valid,
    true,
  );
  const retained = getTicketVerificationKeys();
  assert.deepEqual(await verifyOfflineTicket(token, retained), payload);

  const replacement = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  process.env.TICKET_PUBLIC_KEYS_JSON = JSON.stringify({
    current: replacement.publicKey
      .export({ format: "pem", type: "spki" })
      .toString(),
  });
  const current = getTicketVerificationKeys();
  assert.equal(await verifyOfflineTicket(token, current), null);
  assert.deepEqual(await verifyOfflineTicket(token, retained), payload);
});

test("mismatched private and retained public keys cannot issue tickets", (t) => {
  configureKeys(t);
  const other = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  process.env.TICKET_SIGNING_PRIVATE_KEY_PEM = other.privateKey
    .export({ format: "pem", type: "pkcs8" })
    .toString();
  assert.throws(getActiveTicketSigningKey, /does not match/);
});

test("a curve unsupported by offline scanners is rejected", (t) => {
  configureKeys(t, "secp384r1");
  assert.throws(getActiveTicketSigningKey, /P-256/);
});
