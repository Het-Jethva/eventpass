import { createHash } from "node:crypto";

/** SHA-256 hex digest of presented scan input; unknown input retains only this, never raw contents. */
export function digestScanInput(input: string) {
  return createHash("sha256").update(input).digest("hex");
}
