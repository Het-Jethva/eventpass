import { randomBytes } from "node:crypto";

import { CROCKFORD_BASE32, TICKET_CODE_LENGTH } from "../ticket-code";

// Crockford Base32 drops I, L, O and U, so a code read aloud down a phone
// cannot be mistyped as a different valid code. Bytes at or above 224 are
// discarded rather than folded, which would bias the last eight symbols.
export function createTicketCode(random = randomBytes) {
  let code = "";
  while (code.length < TICKET_CODE_LENGTH) {
    for (const byte of random(TICKET_CODE_LENGTH - code.length)) {
      if (byte < 224) code += CROCKFORD_BASE32[byte % CROCKFORD_BASE32.length];
      if (code.length === TICKET_CODE_LENGTH) break;
    }
  }
  return code;
}
