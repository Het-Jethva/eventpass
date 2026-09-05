import { describe, expect, it } from "vitest";

import { formatTicketCode, normalizeTicketCode } from "./ticket-code";
import { createTicketCode } from "./server/create-ticket-code";

describe("Ticket Code", () => {
  it("creates a 10-character Crockford Base32 code and formats it for people", () => {
    const code = createTicketCode();

    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{10}$/);
    expect(formatTicketCode(code)).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/);
  });

  it("normalizes grouped and lowercase Ticket Codes for manual entry", () => {
    expect(normalizeTicketCode("abcde-fghjk")).toBe("ABCDEFGHJK");
    expect(normalizeTicketCode("ABCDEFGHJK")).toBe("ABCDEFGHJK");
    expect(normalizeTicketCode("too-short")).toBeNull();
  });
});
