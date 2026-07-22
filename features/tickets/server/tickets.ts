import "server-only";

import { db } from "@/lib/db";
import { sendTicket } from "@/lib/email/send-ticket";
import { createTicketApplicationService } from "./ticket-application";
import { getActiveTicketSigningKey } from "./ticket-signing-config";

const ticketApplication = createTicketApplicationService({
  database: db,
  getSigningKey: getActiveTicketSigningKey,
  sendTicketEmail: sendTicket,
});

export const verifyRegistration = ticketApplication.verifyRegistration;
export const getTicketView = ticketApplication.getTicketView;
