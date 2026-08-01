import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  event,
  eventStaff,
  registrationField,
  registrationFieldChoice,
} from "@/lib/db/schema";

import { lockEventForMutation } from "./event-suspension";

export class DraftEventCannotBeDeletedError extends Error {}

export async function deleteDraftEvent(eventId: string, actorUserId: string) {
  return db.transaction(async (transaction) => {
    await lockEventForMutation(transaction, eventId);
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

    const draftFields = await transaction
      .select({ id: registrationField.id })
      .from(registrationField)
      .where(eq(registrationField.eventId, eventId));
    if (draftFields.length > 0) {
      await transaction
        .delete(registrationFieldChoice)
        .where(
          inArray(
            registrationFieldChoice.fieldId,
            draftFields.map((field) => field.id),
          ),
        );
      await transaction
        .delete(registrationField)
        .where(eq(registrationField.eventId, eventId));
    }

    // Durable Registration records begin in issue #6. Their restrictive foreign
    // keys will make this delete fail once the Draft is no longer empty.
    await transaction.delete(eventStaff).where(eq(eventStaff.eventId, eventId));
    await transaction
      .delete(event)
      .where(and(eq(event.id, eventId), eq(event.status, "draft")));
  });
}
