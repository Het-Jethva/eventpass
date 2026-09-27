import { z } from "zod";

export const sqlCount = z.union([
  z.number().int(),
  z.string().regex(/^-?\d+$/).transform((value) => Number(value)),
]);

export const sqlInstant = z.union([z.date(), z.string().min(1)]).transform((value, ctx) => {
  const instant = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(instant.getTime())) {
    ctx.addIssue({ code: "custom", message: "Expected a timestamp." });
    return z.NEVER;
  }
  return instant;
});

export function parseRows<T>(
  schema: z.ZodType<T>,
  rows: unknown,
  message: string,
): T[] {
  const parsed = z.array(schema).safeParse(rows);
  if (!parsed.success) throw new Error(message);
  return parsed.data;
}

export function parseRow<T>(
  schema: z.ZodType<T>,
  row: unknown,
  message: string,
): T {
  const parsed = schema.safeParse(row);
  if (!parsed.success) throw new Error(message);
  return parsed.data;
}
