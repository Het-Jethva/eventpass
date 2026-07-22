import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { event, eventStaff } from "@/lib/db/schema";

export class EventCannotBePublishedError extends Error {}

export async function publishEvent(eventId: string, actorUserId: string) {
  const [publishedEvent] = await db
    .update(event)
    .set({
      status: "published",
      publishedAt: sql`coalesce(${event.publishedAt}, now())`,
      updatedAt: new Date(),
    })
    .from(eventStaff)
    .where(
      and(
        eq(event.id, eventId),
        eq(event.status, "draft"),
        eq(eventStaff.eventId, event.id),
        eq(eventStaff.userId, actorUserId),
        inArray(eventStaff.role, ["owner", "organizer"]),
      ),
    )
    .returning({ slug: event.slug });

  if (!publishedEvent) {
    throw new EventCannotBePublishedError(
      "Only an Organizer can publish a Draft Event.",
    );
  }

  return publishedEvent;
}
