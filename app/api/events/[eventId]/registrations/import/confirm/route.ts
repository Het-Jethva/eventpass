import { z } from "zod";

import { confirmRegistrationImport } from "@/features/registration-import/server/registration-import";
import { getActiveStaffSession } from "@/lib/staff-session";
import { readRequestJson, RequestBodyError } from "@/lib/request-body";

const requestSchema = z.object({ importId: z.string().uuid() });

export async function POST(
  request: Request,
  context: { params: Promise<{ eventId: string }> },
) {
  const session = await getActiveStaffSession();
  if (!session) return Response.json({ message: "Sign in required." }, { status: 401 });
  const { eventId } = await context.params;
  if (!z.string().uuid().safeParse(eventId).success) {
    return Response.json({ message: "Invalid import confirmation." }, { status: 400 });
  }

  try {
    const body = requestSchema.safeParse(await readRequestJson(request, 4 * 1024));
    if (!body.success) {
      return Response.json({ message: "Invalid import confirmation." }, { status: 400 });
    }
    const result = await confirmRegistrationImport(
      eventId,
      session.user.id,
      body.data.importId,
    );
    if (result.outcome === "completed") return Response.json(result);
    const status = result.outcome === "forbidden" ? 403 : result.outcome === "stale" ? 409 : 400;
    const message =
      result.outcome === "expired"
        ? "This preview expired. Upload the CSV again."
        : result.outcome === "stale"
          ? "Registrations or capacity changed. Create a fresh preview."
          : result.outcome === "forbidden"
            ? "Organizer access is required."
            : "This preview cannot be confirmed.";
    return Response.json({ message }, { status });
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return Response.json({ message: error.message }, { status: error.status });
    }
    console.error("Registration import confirmation failed", {
      eventId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return Response.json(
      { message: "The import result could not be confirmed. Retry this preview to check its result." },
      { status: 500 },
    );
  }
}
