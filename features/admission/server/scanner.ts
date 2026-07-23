import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { event, eventStaff } from "@/lib/db/schema";

export async function getScannerEvent(eventId: string, actorUserId: string) {
  const [result] = await db
    .select({
      id: event.id,
      name: event.name,
      status: event.status,
      eventTimeZone: event.eventTimeZone,
      checkInOpensAt: event.checkInOpensAt,
      checkInClosesAt: event.checkInClosesAt,
      role: eventStaff.role,
    })
    .from(eventStaff)
    .innerJoin(event, eq(event.id, eventStaff.eventId))
    .where(and(eq(event.id, eventId), eq(eventStaff.userId, actorUserId)))
    .limit(1);

  return result ?? null;
}
