import { NextResponse, type NextRequest } from "next/server";

import { getOrganizerEventMetrics } from "@/features/events/server/get-event-metrics";
import { getActiveStaffSession } from "@/lib/staff-session";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await context.params;
  const session = await getActiveStaffSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const metrics = await getOrganizerEventMetrics(eventId, session.user.id);

  if (!metrics) {
    return NextResponse.json(
      { error: "Event not found or unauthorized" },
      { status: 404 },
    );
  }

  return NextResponse.json(metrics, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
