import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { event, eventStaff } from "@/lib/db/schema";

const eventSelection = {
  id: event.id,
  name: event.name,
  description: event.description,
  slug: event.slug,
  status: event.status,
  eventTimeZone: event.eventTimeZone,
  startsAt: event.startsAt,
  endsAt: event.endsAt,
  venueName: event.venueName,
  venueAddress: event.venueAddress,
  venueMapUrl: event.venueMapUrl,
  capacity: event.capacity,
  registrationOpensAt: event.registrationOpensAt,
  registrationClosesAt: event.registrationClosesAt,
  checkInOpensAt: event.checkInOpensAt,
  checkInClosesAt: event.checkInClosesAt,
  publishedAt: event.publishedAt,
};

export type EventDetails = typeof event.$inferSelect;

export async function getOrganizerEvent(eventId: string, staffUserId: string) {
  const [result] = await db
    .select({ ...eventSelection, role: eventStaff.role })
    .from(eventStaff)
    .innerJoin(event, eq(event.id, eventStaff.eventId))
    .where(
      and(
        eq(event.id, eventId),
        eq(eventStaff.userId, staffUserId),
        inArray(eventStaff.role, ["owner", "organizer"]),
      ),
    )
    .limit(1);

  return result ?? null;
}

export async function getPublishedEvent(slug: string) {
  const [result] = await db
    .select(eventSelection)
    .from(event)
    .where(and(eq(event.slug, slug), eq(event.status, "published")))
    .limit(1);

  return result ?? null;
}
