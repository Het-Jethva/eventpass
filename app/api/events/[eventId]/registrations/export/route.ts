import { z } from "zod";

import { exportEventRegistrations } from "@/features/registration-import/server/registration-import";
import { getActiveStaffSession } from "@/lib/staff-session";

export async function GET(
  _request: Request,
  context: { params: Promise<{ eventId: string }> },
) {
  const session = await getActiveStaffSession();
  if (!session) return new Response("Sign in required.", { status: 401 });
  const { eventId } = await context.params;
  if (!z.string().uuid().safeParse(eventId).success) {
    return new Response("Invalid Event.", { status: 400 });
  }

  const exported = await exportEventRegistrations(eventId, session.user.id);
  if (!exported) {
    return new Response("Organizer access is required.", { status: 403 });
  }
  return new Response(exported.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exported.fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
