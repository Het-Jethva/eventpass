import { z } from "zod";

import { parseRows, sqlCount, sqlInstant } from "@/lib/sql-row";

const metricColumns = {
  scan_outcome: z.string().nullable(),
  scan_source: z.string().nullable(),
  timestamp_confidence: z.string().nullable(),
  conflict_status: z.string().nullable(),
  delivery_outcome: z.string().nullable(),
  row_count: sqlCount,
};

const operationalRowSchema = z.discriminatedUnion("metric", [
  z.object({ metric: z.literal("scan"), ...metricColumns }),
  z.object({ metric: z.literal("conflict"), ...metricColumns }),
  z.object({ metric: z.literal("email"), ...metricColumns }),
]);

const timelineRowSchema = z.object({
  hour_start: sqlInstant,
  check_in_count: sqlCount,
});

const ROW_MESSAGE = "Event metrics row did not match the expected shape.";

export function parseOperationalRows(rows: unknown) {
  return parseRows(operationalRowSchema, rows, ROW_MESSAGE);
}

export function parseTimelineRows(rows: unknown) {
  return parseRows(timelineRowSchema, rows, ROW_MESSAGE);
}
