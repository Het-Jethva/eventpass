import "server-only";

import { getOrganizerEvent } from "@/features/events/server/get-event";
import { db } from "@/lib/db";
import { sendTicket } from "@/lib/email/send-ticket";
import { sendAdmissionOffer } from "@/lib/email/send-admission-offer";
import { sendWaitlistConfirmation } from "@/lib/email/send-waitlist-confirmation";
import { createTicketApplicationService } from "./ticket-application";
import { getActiveTicketSigningKey } from "./ticket-signing-config";

const ticketApplication = createTicketApplicationService({
  database: db,
  getSigningKey: getActiveTicketSigningKey,
  sendTicketEmail: sendTicket,
  sendAdmissionOfferEmail: sendAdmissionOffer,
  sendWaitlistEmail: sendWaitlistConfirmation,
});

export const verifyRegistration = ticketApplication.verifyRegistration;
export const getManagementView = ticketApplication.getManagementView;
export const updateRegistration = ticketApplication.updateRegistration;
export const resendTicket = ticketApplication.resendTicket;
export const replaceTicket = ticketApplication.replaceTicket;
export const cancelRegistration = ticketApplication.cancelRegistration;
export const claimAdmissionOffer = ticketApplication.claimAdmissionOffer;
export const getAdmissionOfferView = ticketApplication.getAdmissionOfferView;

export async function reconcileOrganizerWaitlist(
  eventId: string,
  actorUserId: string,
) {
  const organizerEvent = await getOrganizerEvent(eventId, actorUserId);
  if (
    !organizerEvent ||
    organizerEvent.status !== "published" ||
    organizerEvent.suspended
  ) {
    return { promoted: 0 };
  }
  return ticketApplication.reconcileEventWaitlist(eventId);
}
