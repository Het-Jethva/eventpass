import { createHash } from "node:crypto";

/** SHA-256 hex digest for hex-encoded bearer capabilities (AGENTS.md: stored only as digests). */
export function digestBearerToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
