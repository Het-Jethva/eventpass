import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import {
  and,
  count,
  desc,
  eq,
  exists,
  gte,
  inArray,
  isNull,
  sql,
} from "drizzle-orm";

import { getPublicRegistrationForm } from "@/features/registration/server/get-public-registration-form";
import { digestBearerToken, isBearerToken } from "@/lib/bearer-token-digest";
import { db, type DatabaseTransaction } from "@/lib/db";
import { deliverAdmissionOfferMessages } from "@/lib/email/deliver-admission-offers";
import { sendAdmissionOffer } from "@/lib/email/send-admission-offer";
import { sendTicket } from "@/lib/email/send-ticket";

import {
  checkIn,
  emailDelivery,
  event,
  registration,
  registrationAnswer,
  registrationField,
  ticket,
} from "../../../lib/db/schema";
import {
  EventSuspendedError,
  lockEventForMutation,
} from "../../events/server/event-suspension";
import { TICKET_ISSUED_TEMPLATE } from "../../messaging/email-delivery-state";
import {
  parseRegistrationAnswerValue,
  validateRegistrationSubmission,
  type PublicRegistrationField,
} from "../../registration/registration-submission";
import {
  reconcileWaitlistInTransaction,
  type AdmissionOfferMessage,
} from "../../registration/server/waitlist-reconciliation";
import { issueReplacementTicket } from "./ticket-issuance";
import { getActiveTicketSigningKey } from "./ticket-signing-config";

/**
 * Ticket emails per Registration per hour, counting the one sent at
 * confirmation. Resending rotates the Registration Management Link and hands
 * the new link back to whoever asked, so without a ceiling a single link
 * holder could keep the Attendee's inbox — and the sending quota — busy for as
 * long as they liked. Three an hour covers "it did not arrive, try again".
 * Failed and still-pending deliveries do not count: those are the cases a
 * resend is for.
 */
const TICKET_EMAIL_WINDOW_MILLISECONDS = 60 * 60_000;

const MAX_TICKET_EMAILS_PER_WINDOW = 3;

async function isTicketEmailLimited(
  transaction: DatabaseTransaction,
  values: { eventId: string; email: string; at: Date },
) {
  const [recent] = await transaction
    .select({ value: count() })
    .from(emailDelivery)
    .where(
      and(
        eq(emailDelivery.template, TICKET_ISSUED_TEMPLATE),
        eq(emailDelivery.eventId, values.eventId),
        eq(emailDelivery.recipient, values.email),
        gte(
          emailDelivery.createdAt,
          new Date(values.at.getTime() - TICKET_EMAIL_WINDOW_MILLISECONDS),
        ),
        inArray(emailDelivery.outcome, ["submitted", "sent", "delivered"]),
      ),
    );
  return (recent?.value ?? 0) >= MAX_TICKET_EMAILS_PER_WINDOW;
}

async function lockActiveCheckInForRegistration(
  transaction: DatabaseTransaction,
  registrationId: string,
) {
  const [active] = await transaction
    .select({ id: checkIn.id })
    .from(checkIn)
    .innerJoin(ticket, eq(ticket.id, checkIn.ticketId))
    .where(
      and(
        eq(ticket.registrationId, registrationId),
        isNull(checkIn.invalidatedAt),
      ),
    )
    .for("update");
  return active;
}

type TicketEmail = Parameters<typeof sendTicket>[0];

type TicketView = {
  attendeeName: string;
  event: {
    name: string;
    slug: string;
    eventTimeZone: string;
    startsAt: Date;
    endsAt: Date;
    venueName: string;
    venueAddress: string;
  };
  ticketCode: string;
  ticketJws: string;
};

export type RegistrationManagementView = {
  attendeeName: string;
  email: string;
  registrationStatus: string;
  event: TicketView["event"] & {
    status: string;
    cancellationReason: string | null;
    suspended: boolean;
    registrationClosesAt: Date;
    checkInOpensAt: Date;
  };
  ticket: {
    status: string;
    code: string;
    signedPayload: string;
  } | null;
  fields: Array<
    PublicRegistrationField & {
      value: string | string[] | boolean | null;
    }
  >;
  canEdit: boolean;
  canReplaceOrCancel: boolean;
};

export type UpdateRegistrationResult =
  | { outcome: "updated" }
  | {
      outcome: "invalid_answers";
      fieldErrors: Record<string, string[]>;
      values: { name: string; answers: Record<string, unknown> };
    }
  | { outcome: "invalid" | "closed" | "unavailable" };

export type TicketManagementResult =
  | {
      outcome: "sent";
      managementToken: string;
      deliveryStatus: "sent" | "failed";
    }
  | { outcome: "replaced"; deliveryStatus: "sent" | "failed" }
  | { outcome: "canceled" }
  | {
      outcome:
        | "invalid"
        | "closed"
        | "inactive"
        | "throttled"
        | "unavailable"
        | "checked_in";
    };

export async function getManagementView(
  managementToken: string,
): Promise<RegistrationManagementView | null> {
  if (!isBearerToken(managementToken)) return null;
  // All reads share a snapshot, including a concurrent ticket replacement.
  return db.transaction(
    async (transaction) => {
      const [record] = await transaction
        .select({
          registrationId: registration.id,
          eventId: event.id,
          attendeeName: registration.attendeeName,
          email: registration.email,
          registrationStatus: registration.status,
          eventName: event.name,
          eventSlug: event.slug,
          eventStatus: event.status,
          cancellationReason: event.cancellationReason,
          suspended: event.suspended,
          eventTimeZone: event.eventTimeZone,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          venueName: event.venueName,
          venueAddress: event.venueAddress,
          registrationClosesAt: event.registrationClosesAt,
          checkInOpensAt: event.checkInOpensAt,
          hasActiveCheckIn: exists(
            transaction
              .select({ one: sql`1` })
              .from(checkIn)
              .innerJoin(ticket, eq(ticket.id, checkIn.ticketId))
              .where(
                and(
                  eq(ticket.registrationId, registration.id),
                  isNull(checkIn.invalidatedAt),
                ),
              ),
          ),
        })
        .from(registration)
        .innerJoin(event, eq(event.id, registration.eventId))
        .where(
          and(
            eq(
              registration.managementTokenDigest,
              digestBearerToken(managementToken),
            ),
            inArray(registration.status, ["confirmed", "canceled"]),
          ),
        )
        .limit(1);
      if (!record) return null;

      const [latestTicket] = await transaction
        .select({
          status: ticket.status,
          code: ticket.code,
          signedPayload: ticket.signedPayload,
        })
        .from(ticket)
        .where(eq(ticket.registrationId, record.registrationId))
        .orderBy(desc(ticket.createdAt), desc(ticket.id))
        .limit(1);

      const form = await getPublicRegistrationForm(record.eventId, transaction);
      const answerRows = await transaction
        .select({
          fieldId: registrationAnswer.fieldId,
          value: registrationAnswer.value,
        })
        .from(registrationAnswer)
        .where(eq(registrationAnswer.registrationId, record.registrationId));
      const answers = new Map(
        answerRows.map(({ fieldId, value }) => [fieldId, value]),
      );
      const viewedAt = new Date();
      const fields = form.map((field) => ({
        ...field,
        value: parseRegistrationAnswerValue(answers.get(field.id) ?? null),
      }));
      const currentTicket = latestTicket ?? null;
      return {
        attendeeName: record.attendeeName,
        email: record.email,
        registrationStatus: record.registrationStatus,
        event: {
          name: record.eventName,
          slug: record.eventSlug,
          status: record.eventStatus,
          cancellationReason: record.cancellationReason,
          suspended: record.suspended,
          eventTimeZone: record.eventTimeZone,
          startsAt: record.startsAt,
          endsAt: record.endsAt,
          venueName: record.venueName,
          venueAddress: record.venueAddress,
          registrationClosesAt: record.registrationClosesAt,
          checkInOpensAt: record.checkInOpensAt,
        },
        ticket: currentTicket,
        fields,
        canEdit:
          !record.suspended &&
          record.eventStatus === "published" &&
          record.registrationStatus === "confirmed" &&
          record.registrationClosesAt > viewedAt,
        canReplaceOrCancel:
          !record.suspended &&
          record.eventStatus === "published" &&
          record.registrationStatus === "confirmed" &&
          currentTicket?.status === "active" &&
          record.checkInOpensAt > viewedAt &&
          !record.hasActiveCheckIn,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

export async function updateRegistration(
  managementToken: string,
  values: { name: string; answers: Record<string, unknown> },
): Promise<UpdateRegistrationResult> {
  if (!isBearerToken(managementToken)) return { outcome: "invalid" };
  const updatedAt = new Date();
  const previousManagementTokenDigest = digestBearerToken(managementToken);
  try {
    return await db.transaction(async (transaction) => {
      const [located] = await transaction
        .select({ eventId: registration.eventId })
        .from(registration)
        .where(
          eq(registration.managementTokenDigest, previousManagementTokenDigest),
        )
        .limit(1);
      if (!located) return { outcome: "invalid" } as const;
      const lockedEvent = await lockEventForMutation(
        transaction,
        located.eventId,
      );
      if (!lockedEvent) return { outcome: "invalid" } as const;

      const [managed] = await transaction
        .select({
          id: registration.id,
          eventId: registration.eventId,
          email: registration.email,
          status: registration.status,
          eventStatus: event.status,
          registrationClosesAt: event.registrationClosesAt,
        })
        .from(registration)
        .innerJoin(event, eq(event.id, registration.eventId))
        .where(
          and(
            eq(registration.eventId, located.eventId),
            eq(
              registration.managementTokenDigest,
              previousManagementTokenDigest,
            ),
          ),
        )
        .for("update")
        .limit(1);
      if (!managed) return { outcome: "invalid" } as const;
      if (
        managed.eventStatus !== "published" ||
        managed.status !== "confirmed" ||
        managed.registrationClosesAt <= updatedAt
      ) {
        return { outcome: "closed" } as const;
      }

      const fields = await getPublicRegistrationForm(
        managed.eventId,
        transaction,
      );
      const validation = validateRegistrationSubmission(
        { name: values.name, email: managed.email, answers: values.answers },
        fields,
      );
      if (!validation.success) {
        return {
          outcome: "invalid_answers",
          fieldErrors: validation.fieldErrors,
          values: {
            name: validation.values.name,
            answers: validation.values.answers,
          },
        } as const;
      }

      await transaction
        .update(registration)
        .set({ attendeeName: validation.data.name, updatedAt })
        .where(eq(registration.id, managed.id));
      const existingAnswers = await transaction
        .select({ fieldId: registrationAnswer.fieldId })
        .from(registrationAnswer)
        .where(eq(registrationAnswer.registrationId, managed.id));
      const answeredFieldIds = new Set(
        existingAnswers.map(({ fieldId }) => fieldId),
      );
      const insertedFieldIds: string[] = [];
      for (const [fieldId, value] of Object.entries(validation.data.answers)) {
        await transaction
          .insert(registrationAnswer)
          .values({ registrationId: managed.id, fieldId, value })
          .onConflictDoUpdate({
            target: [
              registrationAnswer.registrationId,
              registrationAnswer.fieldId,
            ],
            set: { value, updatedAt },
          });
        if (!answeredFieldIds.has(fieldId)) {
          insertedFieldIds.push(fieldId);
        }
      }
      if (insertedFieldIds.length > 0) {
        await transaction
          .update(registrationField)
          .set({ responseCount: sql`${registrationField.responseCount} + 1` })
          .where(inArray(registrationField.id, insertedFieldIds));
      }
      return { outcome: "updated" } as const;
    });
  } catch (error) {
    if (error instanceof EventSuspendedError) return { outcome: "unavailable" };
    throw error;
  }
}

export async function resendTicket(
  managementToken: string,
): Promise<TicketManagementResult> {
  if (!isBearerToken(managementToken)) {
    return { outcome: "invalid" };
  }

  const previousManagementTokenDigest = digestBearerToken(managementToken);
  let emailMessage: TicketEmail | null = null;
  let result: TicketManagementResult;

  try {
    result = await db.transaction(async (transaction) => {
      const [located] = await transaction
        .select({ eventId: registration.eventId })
        .from(registration)
        .where(
          eq(registration.managementTokenDigest, previousManagementTokenDigest),
        )
        .limit(1);
      if (!located) return { outcome: "invalid" } as const;

      const lockedEvent = await lockEventForMutation(
        transaction,
        located.eventId,
      );
      if (!lockedEvent) return { outcome: "invalid" } as const;

      const [managed] = await transaction
        .select({
          registrationId: registration.id,
          registrationStatus: registration.status,
          email: registration.email,
          attendeeName: registration.attendeeName,
          eventId: event.id,
          eventName: event.name,
          eventTimeZone: event.eventTimeZone,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          venueName: event.venueName,
          venueAddress: event.venueAddress,
        })
        .from(registration)
        .innerJoin(event, eq(event.id, registration.eventId))
        .where(
          and(
            eq(registration.eventId, located.eventId),
            eq(
              registration.managementTokenDigest,
              previousManagementTokenDigest,
            ),
          ),
        )
        .for("update")
        .limit(1);
      if (!managed) return { outcome: "invalid" } as const;
      if (managed.registrationStatus !== "confirmed") {
        return { outcome: "inactive" } as const;
      }

      const [activeTicket] = await transaction
        .select({ code: ticket.code, signedPayload: ticket.signedPayload })
        .from(ticket)
        .where(
          and(
            eq(ticket.registrationId, managed.registrationId),
            eq(ticket.status, "active"),
          ),
        )
        .for("update")
        .limit(1);
      if (!activeTicket) return { outcome: "inactive" } as const;

      const rotatedAt = new Date();
      if (
        await isTicketEmailLimited(transaction, {
          eventId: managed.eventId,
          email: managed.email,
          at: rotatedAt,
        })
      ) {
        return { outcome: "throttled" } as const;
      }

      const newManagementToken = randomBytes(32).toString("base64url");
      const [rotated] = await transaction
        .update(registration)
        .set({
          managementTokenDigest: digestBearerToken(newManagementToken),
          updatedAt: rotatedAt,
        })
        .where(
          and(
            eq(registration.id, managed.registrationId),
            eq(
              registration.managementTokenDigest,
              previousManagementTokenDigest,
            ),
          ),
        )
        .returning({ id: registration.id });
      if (!rotated) return { outcome: "invalid" } as const;

      emailMessage = {
        email: managed.email,
        attendeeName: managed.attendeeName,
        eventId: managed.eventId,
        event: {
          name: managed.eventName,
          eventTimeZone: managed.eventTimeZone,
          startsAt: managed.startsAt,
          endsAt: managed.endsAt,
          venueName: managed.venueName,
          venueAddress: managed.venueAddress,
        },
        ticketCode: activeTicket.code,
        ticketJws: activeTicket.signedPayload,
        managementToken: newManagementToken,
      };

      return {
        outcome: "sent",
        deliveryStatus: "sent",
        managementToken: newManagementToken,
      } as const;
    });
  } catch (error) {
    if (error instanceof EventSuspendedError) {
      return { outcome: "unavailable" };
    }
    throw error;
  }

  if (result.outcome !== "sent" || !emailMessage) return result;
  try {
    await sendTicket(emailMessage);
    return result;
  } catch {
    return { ...result, deliveryStatus: "failed" };
  }
}

export async function replaceTicket(
  managementToken: string,
): Promise<TicketManagementResult> {
  if (!isBearerToken(managementToken)) return { outcome: "invalid" };
  const replacedAt = new Date();
  let emailMessage: TicketEmail | null = null;
  const previousManagementTokenDigest = digestBearerToken(managementToken);
  let result: TicketManagementResult;
  try {
    result = await db.transaction(async (transaction) => {
      const [located] = await transaction
        .select({ eventId: registration.eventId })
        .from(registration)
        .where(
          eq(registration.managementTokenDigest, previousManagementTokenDigest),
        )
        .limit(1);
      if (!located) return { outcome: "invalid" } as const;
      const lockedEvent = await lockEventForMutation(
        transaction,
        located.eventId,
      );
      if (!lockedEvent) return { outcome: "invalid" } as const;

      const [managed] = await transaction
        .select({
          registrationId: registration.id,
          registrationStatus: registration.status,
          email: registration.email,
          attendeeName: registration.attendeeName,
          eventId: event.id,
          eventName: event.name,
          eventTimeZone: event.eventTimeZone,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          venueName: event.venueName,
          venueAddress: event.venueAddress,
          eventStatus: event.status,
          checkInOpensAt: event.checkInOpensAt,
        })
        .from(registration)
        .innerJoin(event, eq(event.id, registration.eventId))
        .where(
          and(
            eq(registration.eventId, located.eventId),
            eq(
              registration.managementTokenDigest,
              previousManagementTokenDigest,
            ),
          ),
        )
        .for("update")
        .limit(1);
      if (!managed) return { outcome: "invalid" } as const;
      if (managed.registrationStatus !== "confirmed") {
        return { outcome: "inactive" } as const;
      }
      if (
        managed.eventStatus !== "published" ||
        managed.checkInOpensAt <= replacedAt
      ) {
        return { outcome: "closed" } as const;
      }
      const [activeTicket] = await transaction
        .select({ id: ticket.id })
        .from(ticket)
        .where(
          and(
            eq(ticket.registrationId, managed.registrationId),
            eq(ticket.status, "active"),
          ),
        )
        .for("update")
        .limit(1);
      if (!activeTicket) return { outcome: "inactive" } as const;
      if (
        await lockActiveCheckInForRegistration(
          transaction,
          managed.registrationId,
        )
      ) {
        return { outcome: "checked_in" } as const;
      }
      // A replacement also emails a Ticket, so it shares the resend ceiling;
      // otherwise the limit on one button just moves the loop to the other.
      if (
        await isTicketEmailLimited(transaction, {
          eventId: managed.eventId,
          email: managed.email,
          at: replacedAt,
        })
      ) {
        return { outcome: "throttled" } as const;
      }

      const { ticketCode, ticketJws } = await issueReplacementTicket({
        transaction,
        eventId: managed.eventId,
        registrationId: managed.registrationId,
        activeTicketId: activeTicket.id,
        replacedAt,
        ticketId: randomUUID(),
        signingKey: getActiveTicketSigningKey(),
      });
      emailMessage = {
        email: managed.email,
        attendeeName: managed.attendeeName,
        eventId: managed.eventId,
        event: {
          name: managed.eventName,
          eventTimeZone: managed.eventTimeZone,
          startsAt: managed.startsAt,
          endsAt: managed.endsAt,
          venueName: managed.venueName,
          venueAddress: managed.venueAddress,
        },
        ticketCode,
        ticketJws,
        managementToken,
      };
      return { outcome: "replaced", deliveryStatus: "sent" } as const;
    });
  } catch (error) {
    if (error instanceof EventSuspendedError) return { outcome: "unavailable" };
    throw error;
  }
  if (result.outcome !== "replaced" || !emailMessage) return result;
  try {
    await sendTicket(emailMessage);
    return { ...result, deliveryStatus: "sent" };
  } catch {
    return { ...result, deliveryStatus: "failed" };
  }
}

export async function cancelRegistration(
  managementToken: string,
): Promise<TicketManagementResult> {
  if (!isBearerToken(managementToken)) return { outcome: "invalid" };
  const canceledAt = new Date();
  let offerMessages: AdmissionOfferMessage[] = [];
  const previousManagementTokenDigest = digestBearerToken(managementToken);
  let result: TicketManagementResult;
  try {
    result = await db.transaction(async (transaction) => {
      const [located] = await transaction
        .select({ eventId: registration.eventId })
        .from(registration)
        .where(
          eq(registration.managementTokenDigest, previousManagementTokenDigest),
        )
        .limit(1);
      if (!located) return { outcome: "invalid" } as const;
      const lockedEvent = await lockEventForMutation(
        transaction,
        located.eventId,
      );
      if (!lockedEvent) return { outcome: "invalid" } as const;

      const [managed] = await transaction
        .select({
          registrationId: registration.id,
          registrationStatus: registration.status,
          eventId: event.id,
          eventStatus: event.status,
          checkInOpensAt: event.checkInOpensAt,
        })
        .from(registration)
        .innerJoin(event, eq(event.id, registration.eventId))
        .where(
          and(
            eq(registration.eventId, located.eventId),
            eq(
              registration.managementTokenDigest,
              previousManagementTokenDigest,
            ),
          ),
        )
        .for("update")
        .limit(1);
      if (!managed) return { outcome: "invalid" } as const;
      if (managed.registrationStatus !== "confirmed") {
        return { outcome: "inactive" } as const;
      }
      if (
        managed.eventStatus !== "published" ||
        managed.checkInOpensAt <= canceledAt
      ) {
        return { outcome: "closed" } as const;
      }
      const [activeTicket] = await transaction
        .select({ id: ticket.id })
        .from(ticket)
        .where(
          and(
            eq(ticket.registrationId, managed.registrationId),
            eq(ticket.status, "active"),
          ),
        )
        .for("update")
        .limit(1);
      if (!activeTicket) return { outcome: "inactive" } as const;
      if (
        await lockActiveCheckInForRegistration(
          transaction,
          managed.registrationId,
        )
      ) {
        return { outcome: "checked_in" } as const;
      }
      const invalidatedTickets = await transaction
        .update(ticket)
        .set({ status: "canceled", invalidatedAt: canceledAt })
        .where(
          and(
            eq(ticket.registrationId, managed.registrationId),
            eq(ticket.status, "active"),
          ),
        )
        .returning({ id: ticket.id });
      if (invalidatedTickets.length !== 1)
        return { outcome: "inactive" } as const;
      await transaction
        .update(registration)
        .set({ status: "canceled", updatedAt: canceledAt })
        .where(
          and(
            eq(registration.id, managed.registrationId),
            eq(registration.status, "confirmed"),
          ),
        );
      offerMessages = await reconcileWaitlistInTransaction({
        transaction,
        eventId: managed.eventId,
        reconciledAt: canceledAt,
      });
      return { outcome: "canceled" } as const;
    });
  } catch (error) {
    if (error instanceof EventSuspendedError) return { outcome: "unavailable" };
    throw error;
  }
  await deliverAdmissionOfferMessages(offerMessages, sendAdmissionOffer);
  return result;
}
