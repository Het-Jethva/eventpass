import "server-only";

import { and, eq, inArray, notExists } from "drizzle-orm";

import { db } from "@/lib/db";
import { event, eventStaff, registration } from "@/lib/db/schema";

export class EventCannotReturnToDraftError extends Error {}

export async function returnEventToDraft(eventId: string, actorUserId: string) {
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
        notExists(
          db
            .select({ id: registration.id })
            .from(registration)
            .where(eq(registration.eventId, eventId)),
        ),
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
