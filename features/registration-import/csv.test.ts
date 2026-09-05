import { describe, expect, it } from "vitest";

import { CsvFormatError, encodeCsv, parseBoundedCsv } from "./csv";

describe("Registration CSV handling", () => {
  it("parses quoted fields, embedded newlines, and blank trailing rows", () => {
    expect(
      parseBoundedCsv(
        'name,email,Notes\r\n"Ada, Countess",ada@example.com,"Line one\nLine two"\r\n\r\n',
      ),
    ).toEqual({
      headers: ["name", "email", "Notes"],
      rows: [
        {
          rowNumber: 2,
          values: ["Ada, Countess", "ada@example.com", "Line one\nLine two"],
        },
      ],
    });
  });

  it("rejects duplicate headers and row overflow", () => {
    expect(() => parseBoundedCsv("name,Name\nAda,Lovelace")).toThrow(
      CsvFormatError,
    );
    expect(() => parseBoundedCsv("name,email\nAda,a@example.com,extra")).toThrow(
      "more values",
    );
  });

  it("escapes CSV syntax and neutralizes spreadsheet formulas", () => {
    expect(
      encodeCsv([
        ["name", "answer"],
        ['Ada "A"', "=HYPERLINK(\"https://example.com\")"],
        ["Grace, Hopper", "line one\nline two"],
      ]),
    ).toBe(
      'name,answer\r\n"Ada ""A""","\'=HYPERLINK(""https://example.com"")"\r\n"Grace, Hopper","line one\nline two"',
    );
  });
});
