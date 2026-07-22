import { randomBytes } from "node:crypto";

const CROCKFORD_BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const TICKET_CODE_LENGTH = 10;

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

export function formatTicketCode(code: string) {
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}
