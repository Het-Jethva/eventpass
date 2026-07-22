import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { event, eventStaff } from "@/lib/db/schema";

export class EventCannotReturnToDraftError extends Error {}

export async function returnEventToDraft(eventId: string, actorUserId: string) {
  // Ticket #5 introduces Registrations. Its registration transaction will extend
  // this service with the required NOT EXISTS guard before any can be created.
  const [draftEvent] = await db
    .update(event)
    .set({ status: "draft", updatedAt: new Date() })
    .from(eventStaff)
    .where(
      and(
        eq(event.id, eventId),
        eq(event.status, "published"),
        eq(eventStaff.eventId, event.id),
        eq(eventStaff.userId, actorUserId),
        inArray(eventStaff.role, ["owner", "organizer"]),
      ),
    )
    .returning({ slug: event.slug });

  if (!draftEvent) {
    throw new EventCannotReturnToDraftError(
      "Only an Organizer can return this Published Event to Draft.",
    );
  }

  return draftEvent;
}
