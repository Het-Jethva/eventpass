import "server-only";

import { asc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { event, eventStaff } from "@/lib/db/schema";

export async function listStaffEvents(staffUserId: string) {
  return db
    .select({
      id: event.id,
      name: event.name,
      status: event.status,
      eventTimeZone: event.eventTimeZone,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      venueName: event.venueName,
      capacity: event.capacity,
      role: eventStaff.role,
    })
    .from(eventStaff)
    .innerJoin(event, eq(event.id, eventStaff.eventId))
    .where(eq(eventStaff.userId, staffUserId))
    .orderBy(asc(event.startsAt), asc(event.name));
}
