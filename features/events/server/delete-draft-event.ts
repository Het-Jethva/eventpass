import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { event, eventStaff } from "@/lib/db/schema";

export class DraftEventCannotBeDeletedError extends Error {}

export async function deleteDraftEvent(eventId: string, actorUserId: string) {
  return db.transaction(async (transaction) => {
    const [ownedDraft] = await transaction
      .select({ id: event.id })
      .from(eventStaff)
      .innerJoin(event, eq(event.id, eventStaff.eventId))
      .where(
        and(
          eq(event.id, eventId),
          eq(event.status, "draft"),
          eq(eventStaff.userId, actorUserId),
          eq(eventStaff.role, "owner"),
        ),
      )
      .limit(1);

    if (!ownedDraft) {
      throw new DraftEventCannotBeDeletedError(
        "Only the Event Owner can delete a Draft Event.",
      );
    }

    // Registration records begin in ticket #5. Restrictive foreign keys will make
    // this delete fail once durable Event history exists.
    await transaction.delete(eventStaff).where(eq(eventStaff.eventId, eventId));
    await transaction
      .delete(event)
      .where(and(eq(event.id, eventId), eq(event.status, "draft")));
  });
}
