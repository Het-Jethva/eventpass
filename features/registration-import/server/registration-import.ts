import "server-only";

import { db } from "@/lib/db";
import { sendAdmissionOffer } from "@/lib/email/send-admission-offer";
import { sendTicket } from "@/lib/email/send-ticket";
import { getActiveTicketSigningKey } from "@/features/tickets/server/ticket-signing-config";

import { createRegistrationImportService } from "./registration-import-application";

const registrationImport = createRegistrationImportService({
  database: db,
  getSigningKey: getActiveTicketSigningKey,
  sendAdmissionOfferEmail: sendAdmissionOffer,
  sendTicketEmail: sendTicket,
});

export const previewRegistrationImport = registrationImport.previewImport;
export const confirmRegistrationImport = registrationImport.confirmImport;
export const exportEventRegistrations = registrationImport.exportRegistrations;
