import { z } from "zod";

import { parseRow, parseRows, sqlCount, sqlInstant } from "@/lib/sql-row";

const auditRowSchema = z.object({
  id: z.string().min(1),
  category: z.enum(["privileged", "scan"]),
  action: z.string(),
  actor_name: z.string(),
  actor_email: z.string().nullable(),
  target_type: z.string(),
  target_id: z.string(),
  target_label: z.string().nullable(),
  reason: z.string().nullable(),
  source: z.enum(["online", "offline"]),
  timestamp_confidence: z.enum(["high", "low"]).nullable(),
  scanner_device_id: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  input_method: z.string().nullable(),
  sort_at: sqlInstant,
  sort_at_cursor: z.string().min(1),
});

export type AuditRow = z.infer<typeof auditRowSchema>;

const auditCountSchema = z.object({
  matching: sqlCount,
  total: sqlCount,
});

const ROW_MESSAGE = "Audit log row did not match the expected shape.";

export function parseAuditPageRows(rows: unknown): AuditRow[] {
  return parseRows(auditRowSchema, rows, ROW_MESSAGE);
}

export function parseAuditCounts(
  row: unknown,
): z.infer<typeof auditCountSchema> {
  return parseRow(
    auditCountSchema,
    row ?? { matching: 0, total: 0 },
    ROW_MESSAGE,
  );
}
