export const MAX_IMPORT_BYTES = 512 * 1024;
export const MAX_IMPORT_ROWS = 500;

export class CsvFormatError extends Error {}

function parseCsvRecords(input: string) {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]!;
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      record.push(field);
      field = "";
    } else if (character === "\n") {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }

  if (quoted) throw new CsvFormatError("The CSV contains an unclosed quoted field.");
  record.push(field);
  if (record.some((value) => value.length > 0) || records.length === 0) {
    records.push(record);
  }
  return records;
}

export type ParsedCsv = {
  headers: string[];
  rows: Array<{ rowNumber: number; values: string[] }>;
};

export function parseBoundedCsv(input: string): ParsedCsv {
  if (Buffer.byteLength(input, "utf8") > MAX_IMPORT_BYTES) {
    throw new CsvFormatError("The CSV must be 512 KB or smaller.");
  }

  const records = parseCsvRecords(input.replace(/^\uFEFF/, ""));
  const headers = (records.shift() ?? []).map((header) => header.trim());
  if (headers.length < 2 || headers.some((header) => !header)) {
    throw new CsvFormatError("The CSV needs a non-empty header row.");
  }

  const normalizedHeaders = headers.map((header) => header.toLocaleLowerCase());
  if (new Set(normalizedHeaders).size !== normalizedHeaders.length) {
    throw new CsvFormatError("CSV header names must be unique.");
  }

  const rows = records
    .map((values, index) => ({ rowNumber: index + 2, values }))
    .filter(({ values }) => values.some((value) => value.trim().length > 0));
  if (rows.length === 0) throw new CsvFormatError("The CSV has no attendee rows.");
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new CsvFormatError(
      `The CSV can contain at most ${MAX_IMPORT_ROWS.toLocaleString()} attendee rows.`,
    );
  }
  if (rows.some(({ values }) => values.length > headers.length)) {
    throw new CsvFormatError("A CSV row contains more values than the header row.");
  }

  return {
    headers,
    rows: rows.map((row) => ({
      ...row,
      values: headers.map((_, index) => row.values[index] ?? ""),
    })),
  };
}

function protectSpreadsheetCell(value: string) {
  return /^[\t\r ]*[=+\-@]/.test(value) ? `'${value}` : value;
}

export function encodeCsv(rows: string[][]) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const protectedCell = protectSpreadsheetCell(cell);
          return /[",\r\n]/.test(protectedCell)
            ? `"${protectedCell.replaceAll('"', '""')}"`
            : protectedCell;
        })
        .join(","),
    )
    .join("\r\n");
}
