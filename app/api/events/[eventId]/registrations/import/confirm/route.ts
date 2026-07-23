import { z } from "zod";

import { confirmRegistrationImport } from "@/features/registration-import/server/registration-import";
import { getActiveStaffSession } from "@/lib/staff-session";

const requestSchema = z.object({ importId: z.string().uuid() });

export async function POST(
  request: Request,
  context: { params: Promise<{ eventId: string }> },
) {
  const session = await getActiveStaffSession();
  if (!session) return Response.json({ message: "Sign in required." }, { status: 401 });
  const { eventId } = await context.params;
  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!z.string().uuid().safeParse(eventId).success || !body.success) {
    return Response.json({ message: "Invalid import confirmation." }, { status: 400 });
  }

  try {
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
  } catch {
    return Response.json(
      { message: "Nothing was imported. Review the CSV and try again." },
      { status: 500 },
    );
  }
}
