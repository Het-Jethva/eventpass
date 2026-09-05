// Nothing here imports from Node. A Ticket Code is displayed by the roster, the
// audit log, the admin support view, the landing showcase, and the ticket page
// itself — some of those are client components, and a single `node:crypto`
// import at the top of this file put the whole generator in their bundle graph.
// Generation lives in `./server/create-ticket-code`.

export const CROCKFORD_BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const TICKET_CODE_LENGTH = 10;

export function normalizeTicketCode(input: string) {
  const normalized = input.toUpperCase().replace(/[\s-]/g, "");
  return isTicketCode(normalized) ? normalized : null;
}

/** Strict check for the canonical stored form: 10 unbroken Crockford Base32 characters. */
export function isTicketCode(value: string) {
  return new RegExp(`^[${CROCKFORD_BASE32}]{${TICKET_CODE_LENGTH}}$`).test(value);
}

/** Grouped for reading aloud and comparing character by character. */
export function formatTicketCode(code: string) {
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}
