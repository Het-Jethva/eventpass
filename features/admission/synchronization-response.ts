import { z } from "zod";

import { STORED_SCAN_OUTCOMES } from "./scan-outcomes";

const synchronizationResponseSchema = z.discriminatedUnion("outcome", [
  z.object({
    outcome: z.literal("acknowledged"),
    results: z.array(
      z.object({
        id: z.uuid(),
        ticketId: z.uuid().nullable(),
        outcome: z.enum(STORED_SCAN_OUTCOMES),
        changed: z.boolean(),
      }),
    ),
  }),
  z.object({ outcome: z.literal("unauthorized"), results: z.tuple([]) }),
  z.object({ outcome: z.literal("invalid_request"), results: z.tuple([]) }),
]);

export type SynchronizationResponse = z.infer<typeof synchronizationResponseSchema>;

export function parseSynchronizationResponse(
  body: unknown,
  expectedAttemptIds: readonly string[],
): SynchronizationResponse {
  const parsed = synchronizationResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error("Synchronization was not acknowledged.");
  }
  if (parsed.data.outcome === "acknowledged") {
    const expected = new Set(expectedAttemptIds);
    const received = new Set(parsed.data.results.map((result) => result.id));
    if (
      expected.size !== expectedAttemptIds.length ||
      received.size !== expected.size ||
      parsed.data.results.length !== expected.size ||
      [...received].some((id) => !expected.has(id))
    ) {
      throw new Error("Synchronization returned results for unexpected scan attempts.");
    }
  }
  return parsed.data;
}
