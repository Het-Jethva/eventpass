import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  auditEntry,
  admissionOffer,
  capacityHold,
  emailDelivery,
  event,
  eventStaff,
  ownershipTransfer,
  registration,
  registrationAnswer,
  registrationField,
  registrationFieldChoice,
  registrationImport,
  registrationVerification,
  scanAttempt,
  staffInvitation,
  supportAccess,
  ticket,
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

    const draftRegistrations = transaction
      .select({ id: registration.id })
      .from(registration)
      .where(eq(registration.eventId, eventId));
    const [recordedScan] = await transaction.select({ id: scanAttempt.id })
      .from(scanAttempt).where(eq(scanAttempt.eventId, eventId)).limit(1);
    if (recordedScan) {
      throw new DraftEventCannotBeDeletedError(
        "Draft Events with scan history cannot be deleted.",
      );
    }
    await transaction.delete(ticket).where(eq(ticket.eventId, eventId));
    await transaction.delete(registrationAnswer)
      .where(inArray(registrationAnswer.registrationId, draftRegistrations));
    await transaction.delete(capacityHold)
      .where(inArray(capacityHold.registrationId, draftRegistrations));
    await transaction.delete(admissionOffer)
      .where(inArray(admissionOffer.registrationId, draftRegistrations));
    await transaction.delete(registrationVerification)
      .where(inArray(registrationVerification.registrationId, draftRegistrations));
    await transaction.delete(registration).where(eq(registration.eventId, eventId));
    await transaction.delete(registrationImport).where(eq(registrationImport.eventId, eventId));

    const draftFields = transaction
      .select({ id: registrationField.id })
      .from(registrationField)
      .where(eq(registrationField.eventId, eventId));
    await transaction.delete(registrationFieldChoice)
      .where(inArray(registrationFieldChoice.fieldId, draftFields));
    await transaction.delete(registrationField)
      .where(eq(registrationField.eventId, eventId));

    await transaction
      .delete(staffInvitation)
      .where(eq(staffInvitation.eventId, eventId));
    await transaction
      .delete(ownershipTransfer)
      .where(eq(ownershipTransfer.eventId, eventId));
    await transaction
      .update(auditEntry)
      .set({ eventId: null })
      .where(eq(auditEntry.eventId, eventId));
    await transaction.update(emailDelivery).set({ eventId: null })
      .where(eq(emailDelivery.eventId, eventId));
    await transaction.delete(supportAccess).where(eq(supportAccess.eventId, eventId));
    await transaction.delete(eventStaff).where(eq(eventStaff.eventId, eventId));
    await transaction
      .delete(event)
      .where(and(eq(event.id, eventId), eq(event.status, "draft")));
  });
}
