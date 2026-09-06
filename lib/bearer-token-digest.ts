import { createHash } from "node:crypto";

/** SHA-256 hex digest for hex-encoded bearer capabilities (AGENTS.md: stored only as digests). */
export function digestBearerToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** SHA-256 digest for base64url-encoded tokens (staff invitations, magic-link verification rows). */
export function digestTokenBase64Url(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}
