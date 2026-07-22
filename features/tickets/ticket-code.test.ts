import { describe, expect, it } from "vitest";

import { createTicketCode, formatTicketCode } from "./ticket-code";

describe("Ticket Code", () => {
  it("creates a 10-character Crockford Base32 code and formats it for people", () => {
    const code = createTicketCode();

    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{10}$/);
    expect(formatTicketCode(code)).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/);
  });
});
