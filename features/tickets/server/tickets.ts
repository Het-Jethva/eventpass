import "server-only";

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
export const reconcileEventWaitlist = ticketApplication.reconcileEventWaitlist;
