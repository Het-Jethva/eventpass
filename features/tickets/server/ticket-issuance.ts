import "server-only";

import { and, eq } from "drizzle-orm";

import { ticket } from "@/lib/db/schema";
import { signTicket } from "../ticket-crypto";

type TicketIssuanceDatabase = typeof import("@/lib/db").db;
type TicketIssuanceTransaction = Parameters<
  Parameters<TicketIssuanceDatabase["transaction"]>[0]
>[0];
type TicketIssuanceKey = Parameters<typeof signTicket>[1];

/**
 * Ticket issuance, owned once. Every path that hands an Attendee a Ticket —
 * email verification, Admission Offer claim, Ticket Replacement — allocates
 * an Event-scoped Ticket Code, signs the payload, and inserts the row
 * through this one seam, so uniqueness and the signed shape cannot drift
 * between the three callers.
 */
export async function allocateTicketCode({
  transaction,
  eventId,
  createTicketCode,
}: {
  transaction: TicketIssuanceTransaction;
  eventId: string;
  createTicketCode: () => string;
}): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = createTicketCode();
    const [existing] = await transaction
      .select({ id: ticket.id })
      .from(ticket)
      .where(and(eq(ticket.eventId, eventId), eq(ticket.code, candidate)))
      .limit(1);
    if (!existing) return candidate;
  }
  throw new Error("Could not allocate a unique Ticket Code.");
}

export async function issueTicket({  transaction,
  eventId,
  registrationId,
  ticketId,
  signingKey,
  createTicketCode,
}: {
  transaction: TicketIssuanceTransaction;
  eventId: string;
  registrationId: string;
  ticketId: string;
  signingKey: TicketIssuanceKey;
  createTicketCode: () => string;
}): Promise<{ ticketCode: string; ticketJws: string }> {
  const ticketCode = await allocateTicketCode({
    transaction,
    eventId,
    createTicketCode,
  });
  const ticketJws = signTicket({ eventId, ticketId }, signingKey);
  await transaction.insert(ticket).values({
    id: ticketId,
    eventId,
    registrationId,
    code: ticketCode,
    signedPayload: ticketJws,
    signingKeyId: signingKey.id,
  });
  return { ticketCode, ticketJws };
}

/**
 * Ticket Replacement: the predecessor leaves active before the successor
 * arrives. The partial unique index on active Tickets per Registration is
 * checked per statement, so this ordering holds even inside one
 * transaction — issuing first and invalidating after would violate it.
 */
export async function issueReplacementTicket({
  transaction,
  eventId,
  registrationId,
  activeTicketId,
  replacedAt,
  ticketId,
  signingKey,
  createTicketCode,
}: {
  transaction: TicketIssuanceTransaction;
  eventId: string;
  registrationId: string;
  activeTicketId: string;
  replacedAt: Date;
  ticketId: string;
  signingKey: TicketIssuanceKey;
  createTicketCode: () => string;
}): Promise<{ ticketCode: string; ticketJws: string }> {
  await transaction
    .update(ticket)
    .set({ status: "replaced", invalidatedAt: replacedAt })
    .where(and(eq(ticket.id, activeTicketId), eq(ticket.status, "active")));
  return issueTicket({
    transaction,
    eventId,
    registrationId,
    ticketId,
    signingKey,
    createTicketCode,
  });
}
