import { z } from "zod";

import { synchronizeOfflineAttempts } from "@/features/admission/server/synchronize-offline";

const attemptSchema = z.object({
  id: z.uuid(),
  eventId: z.uuid(),
  ticketId: z.uuid().nullable(),
  inputDigest: z.string().regex(/^[0-9a-f]{64}$/),
  inputMethod: z.enum(["camera", "manual"]),
  capturedOutcome: z.enum([
    "provisional",
    "duplicate",
    "invalid",
    "unknown",
    "canceled",
    "replaced",
    "expired",
    "outside_window",
  ]),
  deviceRecordedAt: z.iso.datetime(),
  serverTimeAnchor: z.iso.datetime(),
  monotonicElapsedMs: z.number().int().nonnegative(),
  timestampConfidence: z.enum(["high", "low"]),
  signedTicket: z.string().max(4096).nullable(),
  scannerDeviceId: z.uuid(),
});

const synchronizationSchema = z.object({
  authorization: z.string().min(1).max(4096),
  attempts: z.array(attemptSchema).min(1).max(50),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { outcome: "invalid_request", results: [] },
      { status: 400 },
    );
  }
  const parsed = synchronizationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { outcome: "invalid_request", results: [] },
      { status: 400 },
    );
  }
  const result = await synchronizeOfflineAttempts(parsed.data);
  return Response.json(result, {
    status: result.outcome === "unauthorized" ? 401 : 200,
  });
}
