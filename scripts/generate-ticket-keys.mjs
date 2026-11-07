import { generateKeyPairSync, randomUUID } from "node:crypto";

const id = `key-${randomUUID()}`;
const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
});
const privatePem = privateKey
  .export({ format: "pem", type: "pkcs8" })
  .toString();
const publicPem = publicKey.export({ format: "pem", type: "spki" }).toString();

process.stdout.write(
  [
    `TICKET_SIGNING_KEY_ID=${id}`,
    `TICKET_SIGNING_PRIVATE_KEY_PEM=${JSON.stringify(privatePem)}`,
    `TICKET_PUBLIC_KEYS_JSON='${JSON.stringify({ [id]: publicPem })}'`,
    "",
  ].join("\n"),
);
