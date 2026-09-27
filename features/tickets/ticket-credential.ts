// Nothing here imports from Node. Both admission runtimes — the online
// scanner on the server and the offline scanner in the browser — resolve a
// presented Ticket from the same two transports: a typed Ticket Code or a
// scanned JWS. The dispatch lives here so a Ticket Code-shaped JWS, a
// JWS-shaped code, or a cross-Event payload cannot take different branches
// per caller.

import { normalizeTicketCode } from "./ticket-code";

export type TicketCredential =
  | { kind: "code"; code: string }
  | { kind: "jws"; jws: string };

/**
 * A Ticket Code is 10 unbroken Crockford Base32 characters; anything else is
 * a JWS for the verifier of the caller's runtime. A compact JWS always
 * carries two dots, so the two transports cannot collide.
 */
export function classifyTicketCredential(input: string): TicketCredential {
  const code = normalizeTicketCode(input);
  return code ? { kind: "code", code } : { kind: "jws", jws: input };
}
