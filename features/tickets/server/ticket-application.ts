import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";

import { and, asc, count, desc, eq, gte, inArray } from "drizzle-orm";

import {
  admissionOffer,
  capacityHold,
  emailDelivery,
  event,
  registration,
  registrationAnswer,
  registrationField,
  registrationFieldChoice,
  registrationVerification,
  ticket,
} from "../../../lib/db/schema";
import {
  validateRegistrationSubmission,
  type PublicRegistrationField,
} from "../../registration/registration-submission";
import {
  reconcileWaitlistInTransaction,
  type AdmissionOfferMessage,
} from "../../registration/server/waitlist-reconciliation";
import {
  assertEventNotSuspended,
  EventSuspendedError,
  isEventSuspended,
  lockEvent,
  lockEventForMutation,
} from "../../events/server/event-suspension";
import { deliverAdmissionOfferMessages } from "@/lib/email/deliver-admission-offers";
import { TICKET_ISSUED_TEMPLATE } from "../../messaging/email-delivery-state";
import { createTicketCode as createRandomTicketCode } from "./create-ticket-code";
import { signTicket } from "../ticket-crypto";

type TicketDatabase = typeof import("../../../lib/db").db;
type TicketTransaction = Parameters<
  Parameters<TicketDatabase["transaction"]>[0]
>[0];

/**
 * Ticket emails per Registration per hour, counting the one sent at
 * confirmation. Resending rotates the Registration Management Link and hands
 * the new link back to whoever asked, so without a ceiling a single link
 * holder could keep the Attendee's inbox — and the sending quota — busy for as
 * long as they liked. Three an hour covers "it did not arrive, try again".
 */
const TICKET_EMAIL_WINDOW_MILLISECONDS = 60 * 60_000;
const MAX_TICKET_EMAILS_PER_WINDOW = 3;

async function isTicketEmailLimited(
  transaction: TicketTransaction,
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
      ),
    );
  return (recent?.value ?? 0) >= MAX_TICKET_EMAILS_PER_WINDOW;
}

type SigningKey = Parameters<typeof signTicket>[1];

type TicketEmail = {
  email: string;
  attendeeName: string;
  eventId: string;
  event: {
    name: string;
    eventTimeZone: string;
    startsAt: Date;
    endsAt: Date;
    venueName: string;
    venueAddress: string;
  };
  ticketCode: string;
  ticketJws: string;
  managementToken: string;
};

type TicketApplicationDependencies = {
  database: TicketDatabase;
  getSigningKey: () => SigningKey;
  sendTicketEmail: (message: TicketEmail) => Promise<void>;
  sendAdmissionOfferEmail?: (message: AdmissionOfferMessage) => Promise<void>;
  sendWaitlistEmail?: (message: {
    email: string;
    attendeeName: string;
    eventId: string;
    eventName: string;
    eventSlug: string;
  }) => Promise<void>;
  now?: () => Date;
  createManagementToken?: () => string;
  createTicketCode?: () => string;
  createTicketId?: () => string;
  createOfferToken?: () => string;
};

export type RegistrationVerificationResult =
  | {
      outcome: "confirmed";
      managementToken: string;
      ticketId: string;
      deliveryStatus: "sent" | "failed";
    }
  | { outcome: "waitlisted" | "offered" | "unavailable" }
  | { outcome: "expired" | "consumed" | "invalid" | "mismatched" | "canceled" };

export type AdmissionOfferClaimResult =
  | {
      outcome: "confirmed";
      managementToken: string;
      ticketId: string;
      deliveryStatus: "sent" | "failed";
    }
  | { outcome: "expired" | "consumed" | "invalid" | "canceled" | "unavailable" };

export type AdmissionOfferView = {
  attendeeName: string;
  eventName: string;
  eventSlug: string;
  eventTimeZone: string;
  expiresAt: Date;
  suspended: boolean;
};

export type TicketView = {
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
  | { outcome: "invalid" | "closed" };

export type TicketManagementResult = {
  outcome:
    | "sent"
    | "replaced"
    | "canceled"
    | "invalid"
    | "closed"
    | "inactive"
    | "throttled"
    | "unavailable";
  deliveryStatus?: "sent" | "failed";
  managementToken?: string;
};

export function digestBearerToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isWellFormedCapability(token: string) {
  return /^[A-Za-z0-9_-]{32,128}$/.test(token);
}

export function createTicketApplicationService({
  database,
  getSigningKey,
  sendTicketEmail,
  sendAdmissionOfferEmail = async () => undefined,
  sendWaitlistEmail = async () => undefined,
  now = () => new Date(),
  createManagementToken = () => randomBytes(32).toString("base64url"),
  createTicketCode = createRandomTicketCode,
  createTicketId = randomUUID,
  createOfferToken,
}: TicketApplicationDependencies) {
  async function verifyRegistration(
    eventSlug: string,
    verificationToken: string,
  ): Promise<RegistrationVerificationResult> {
    if (!isWellFormedCapability(verificationToken)) return { outcome: "invalid" };
    const verifiedAt = now();
    const managementToken = createManagementToken();
    const ticketId = createTicketId();
    const signingKey = getSigningKey();
    let emailMessage: TicketEmail | null = null;
    let offerMessages: AdmissionOfferMessage[] = [];
    let waitlistMessage: Parameters<typeof sendWaitlistEmail>[0] | null = null;

    const result = await database.transaction(async (transaction) => {
      const [lockedEvent] = await transaction
        .select({
          id: event.id,
          name: event.name,
          slug: event.slug,
          status: event.status,
          eventTimeZone: event.eventTimeZone,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          venueName: event.venueName,
          venueAddress: event.venueAddress,
          suspended: event.suspended,
        })
        .from(event)
        .where(eq(event.slug, eventSlug))
        .for("update")
        .limit(1);
      if (!lockedEvent) return { outcome: "mismatched" } as const;
      if (isEventSuspended(lockedEvent)) {
        return { outcome: "unavailable" } as const;
      }
      if (lockedEvent.status === "canceled") {
        return { outcome: "canceled" } as const;
      }
      if (lockedEvent.status !== "published") {
        return { outcome: "mismatched" } as const;
      }

      const [capability] = await transaction
        .select({
          verificationId: registrationVerification.id,
          verificationExpiresAt: registrationVerification.expiresAt,
          consumedAt: registrationVerification.consumedAt,
          registrationId: registration.id,
          registrationEventId: registration.eventId,
          attendeeName: registration.attendeeName,
          email: registration.email,
          status: registration.status,
          capacityOutcome: registration.capacityOutcome,
        })
        .from(registrationVerification)
        .innerJoin(registration, eq(registration.id, registrationVerification.registrationId))
        .where(eq(registrationVerification.tokenDigest, digestBearerToken(verificationToken)))
        .for("update")
        .limit(1);
      if (!capability) return { outcome: "invalid" } as const;
      if (capability.registrationEventId !== lockedEvent.id) {
        return { outcome: "mismatched" } as const;
      }
      if (capability.consumedAt || capability.status === "confirmed") {
        return { outcome: "consumed" } as const;
      }
      if (capability.status !== "unconfirmed") {
        return { outcome: "mismatched" } as const;
      }

      if (capability.capacityOutcome === "waitlist") {
        if (capability.verificationExpiresAt <= verifiedAt) {
          await transaction
            .update(registration)
            .set({ status: "expired", updatedAt: verifiedAt })
            .where(eq(registration.id, capability.registrationId));
          return { outcome: "expired" } as const;
        }
        await transaction
          .update(registrationVerification)
          .set({ consumedAt: verifiedAt })
          .where(eq(registrationVerification.id, capability.verificationId));
        await transaction
          .update(registration)
          .set({ status: "waitlisted", verifiedAt, updatedAt: verifiedAt })
          .where(eq(registration.id, capability.registrationId));
        offerMessages = await reconcileWaitlistInTransaction({
          transaction,
          eventId: lockedEvent.id,
          reconciledAt: verifiedAt,
          createOfferToken,
        });
        const offered = offerMessages.some(
          ({ email }) => email === capability.email,
        );
        if (!offered) {
          waitlistMessage = {
            email: capability.email,
            attendeeName: capability.attendeeName,
            eventId: lockedEvent.id,
            eventName: lockedEvent.name,
            eventSlug: lockedEvent.slug,
          };
        }
        return { outcome: offered ? "offered" : "waitlisted" } as const;
      }

      if (capability.capacityOutcome !== "capacity_hold") {
        return { outcome: "mismatched" } as const;
      }

      const [hold] = await transaction
        .select({ id: capacityHold.id, expiresAt: capacityHold.expiresAt, claimedAt: capacityHold.claimedAt })
        .from(capacityHold)
        .where(eq(capacityHold.registrationId, capability.registrationId))
        .for("update")
        .limit(1);
      if (!hold) return { outcome: "mismatched" } as const;
      if (
        capability.verificationExpiresAt <= verifiedAt ||
        hold.expiresAt <= verifiedAt
      ) {
        await transaction
          .update(registration)
          .set({ status: "expired", updatedAt: verifiedAt })
          .where(
            and(
              eq(registration.id, capability.registrationId),
              eq(registration.status, "unconfirmed"),
            ),
          );
        return { outcome: "expired" } as const;
      }
      if (hold.claimedAt) return { outcome: "consumed" } as const;

      let ticketCode: string | null = null;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const candidate = createTicketCode();
        const [existing] = await transaction
          .select({ id: ticket.id })
          .from(ticket)
          .where(and(eq(ticket.eventId, lockedEvent.id), eq(ticket.code, candidate)))
          .limit(1);
        if (!existing) {
          ticketCode = candidate;
          break;
        }
      }
      if (!ticketCode) throw new Error("Could not allocate a unique Ticket Code.");

      const ticketJws = signTicket(
        { eventId: lockedEvent.id, ticketId },
        signingKey,
      );
      await transaction.insert(ticket).values({
        id: ticketId,
        eventId: lockedEvent.id,
        registrationId: capability.registrationId,
        code: ticketCode,
        signedPayload: ticketJws,
        signingKeyId: signingKey.id,
      });
      await transaction
        .update(capacityHold)
        .set({ claimedAt: verifiedAt })
        .where(and(eq(capacityHold.id, hold.id), eq(capacityHold.registrationId, capability.registrationId)));
      await transaction
        .update(registrationVerification)
        .set({ consumedAt: verifiedAt })
        .where(eq(registrationVerification.id, capability.verificationId));
      await transaction
        .update(registration)
        .set({
          status: "confirmed",
          verifiedAt,
          managementTokenDigest: digestBearerToken(managementToken),
          updatedAt: verifiedAt,
        })
        .where(eq(registration.id, capability.registrationId));

      emailMessage = {
        email: capability.email,
        attendeeName: capability.attendeeName,
        eventId: lockedEvent.id,
        event: lockedEvent,
        ticketCode,
        ticketJws,
        managementToken,
      };
      return {
        outcome: "confirmed",
        managementToken,
        ticketId,
        deliveryStatus: "sent",
      } as const;
    });

    await deliverAdmissionOfferMessages(offerMessages, sendAdmissionOfferEmail);
    if (waitlistMessage) {
      try {
        await sendWaitlistEmail(waitlistMessage);
      } catch {
        // Domain state is committed independently from delivery outcomes.
      }
    }
    if (result.outcome !== "confirmed" || !emailMessage) return result;
    try {
      await sendTicketEmail(emailMessage);
      return result;
    } catch {
      return { ...result, deliveryStatus: "failed" };
    }
  }

  async function claimAdmissionOffer(
    offerToken: string,
  ): Promise<AdmissionOfferClaimResult> {
    if (!isWellFormedCapability(offerToken)) return { outcome: "invalid" };
    const claimedAt = now();
    const managementToken = createManagementToken();
    const ticketId = createTicketId();
    const signingKey = getSigningKey();
    let emailMessage: TicketEmail | null = null;
    let promotedMessages: AdmissionOfferMessage[] = [];

    let result: AdmissionOfferClaimResult;
    try {
      result = await database.transaction(async (transaction) => {
      const [located] = await transaction
        .select({ eventId: registration.eventId })
        .from(admissionOffer)
        .innerJoin(registration, eq(registration.id, admissionOffer.registrationId))
        .where(eq(admissionOffer.tokenDigest, digestBearerToken(offerToken)))
        .limit(1);
      if (!located) return { outcome: "invalid" } as const;

      const lockedEvent = await lockEvent(transaction, located.eventId);
      if (!lockedEvent) return { outcome: "invalid" } as const;
      assertEventNotSuspended(lockedEvent);

      promotedMessages = await reconcileWaitlistInTransaction({
        transaction,
        eventId: located.eventId,
        reconciledAt: claimedAt,
        createOfferToken,
      });
      const [offered] = await transaction
        .select({
          offerId: admissionOffer.id,
          offerStatus: admissionOffer.status,
          expiresAt: admissionOffer.expiresAt,
          registrationId: registration.id,
          registrationStatus: registration.status,
          attendeeName: registration.attendeeName,
          email: registration.email,
          eventId: event.id,
          eventStatus: event.status,
          eventName: event.name,
          eventTimeZone: event.eventTimeZone,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          venueName: event.venueName,
          venueAddress: event.venueAddress,
        })
        .from(admissionOffer)
        .innerJoin(registration, eq(registration.id, admissionOffer.registrationId))
        .innerJoin(event, eq(event.id, registration.eventId))
        .where(eq(admissionOffer.tokenDigest, digestBearerToken(offerToken)))
        .for("update")
        .limit(1);
      if (!offered) return { outcome: "invalid" } as const;
      if (offered.eventStatus === "canceled") {
        return { outcome: "canceled" } as const;
      }
      if (offered.eventStatus !== "published") {
        return { outcome: "expired" } as const;
      }
      if (offered.offerStatus === "claimed" || offered.registrationStatus === "confirmed") {
        return { outcome: "consumed" } as const;
      }
      if (
        offered.offerStatus !== "active" ||
        offered.registrationStatus !== "waitlisted" ||
        offered.expiresAt <= claimedAt
      ) {
        return { outcome: "expired" } as const;
      }

      let ticketCode: string | null = null;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const candidate = createTicketCode();
        const [existing] = await transaction
          .select({ id: ticket.id })
          .from(ticket)
          .where(and(eq(ticket.eventId, offered.eventId), eq(ticket.code, candidate)))
          .limit(1);
        if (!existing) {
          ticketCode = candidate;
          break;
        }
      }
      if (!ticketCode) throw new Error("Could not allocate a unique Ticket Code.");

      const ticketJws = signTicket(
        { eventId: offered.eventId, ticketId },
        signingKey,
      );
      await transaction.insert(ticket).values({
        id: ticketId,
        eventId: offered.eventId,
        registrationId: offered.registrationId,
        code: ticketCode,
        signedPayload: ticketJws,
        signingKeyId: signingKey.id,
      });
      await transaction
        .update(admissionOffer)
        .set({ status: "claimed", claimedAt })
        .where(
          and(
            eq(admissionOffer.id, offered.offerId),
            eq(admissionOffer.status, "active"),
          ),
        );
      await transaction
        .update(registration)
        .set({
          status: "confirmed",
          managementTokenDigest: digestBearerToken(managementToken),
          updatedAt: claimedAt,
        })
        .where(
          and(
            eq(registration.id, offered.registrationId),
            eq(registration.status, "waitlisted"),
          ),
        );

      emailMessage = {
        email: offered.email,
        attendeeName: offered.attendeeName,
        eventId: offered.eventId,
        event: {
          name: offered.eventName,
          eventTimeZone: offered.eventTimeZone,
          startsAt: offered.startsAt,
          endsAt: offered.endsAt,
          venueName: offered.venueName,
          venueAddress: offered.venueAddress,
        },
        ticketCode,
        ticketJws,
        managementToken,
      };
      return {
        outcome: "confirmed",
        managementToken,
        ticketId,
        deliveryStatus: "sent",
      } as const;
      });
    } catch (error) {
      if (error instanceof EventSuspendedError) {
        return { outcome: "unavailable" };
      }
      throw error;
    }

    await deliverAdmissionOfferMessages(
      promotedMessages,
      sendAdmissionOfferEmail,
    );
    if (result.outcome !== "confirmed" || !emailMessage) return result;
    try {
      await sendTicketEmail(emailMessage);
      return result;
    } catch {
      return { ...result, deliveryStatus: "failed" };
    }
  }

  async function getAdmissionOfferView(
    offerToken: string,
  ): Promise<AdmissionOfferView | null> {
    if (!isWellFormedCapability(offerToken)) return null;
    const viewedAt = now();
    let promotedMessages: AdmissionOfferMessage[] = [];
    const view = await database.transaction(async (transaction) => {
      const [located] = await transaction
        .select({ eventId: registration.eventId })
        .from(admissionOffer)
        .innerJoin(registration, eq(registration.id, admissionOffer.registrationId))
        .where(eq(admissionOffer.tokenDigest, digestBearerToken(offerToken)))
        .limit(1);
      if (!located) return null;
      const lockedEvent = await lockEvent(transaction, located.eventId);
      if (!lockedEvent) return null;
      if (!isEventSuspended(lockedEvent)) {
        promotedMessages = await reconcileWaitlistInTransaction({
          transaction,
          eventId: located.eventId,
          reconciledAt: viewedAt,
          createOfferToken,
        });
      }
      const [activeOffer] = await transaction
        .select({
          attendeeName: registration.attendeeName,
          eventName: event.name,
          eventSlug: event.slug,
          eventTimeZone: event.eventTimeZone,
          expiresAt: admissionOffer.expiresAt,
          suspended: event.suspended,
        })
        .from(admissionOffer)
        .innerJoin(registration, eq(registration.id, admissionOffer.registrationId))
        .innerJoin(event, eq(event.id, registration.eventId))
        .where(
          and(
            eq(admissionOffer.tokenDigest, digestBearerToken(offerToken)),
            eq(admissionOffer.status, "active"),
            eq(registration.status, "waitlisted"),
            eq(event.status, "published"),
          ),
        )
        .limit(1);
      return activeOffer ?? null;
    });
    await deliverAdmissionOfferMessages(
      promotedMessages,
      sendAdmissionOfferEmail,
    );
    return view;
  }

  async function reconcileEventWaitlist(eventId: string) {
    const reconciledAt = now();
    const messages = await database.transaction(async (transaction) => {
      await lockEventForMutation(transaction, eventId);
      return reconcileWaitlistInTransaction({
        transaction,
        eventId,
        reconciledAt,
        createOfferToken,
      });
    });
    await deliverAdmissionOfferMessages(messages, sendAdmissionOfferEmail);
    return { promoted: messages.length };
  }

  async function getTicketView(managementToken: string): Promise<TicketView | null> {
    if (!isWellFormedCapability(managementToken)) return null;
    const [view] = await database
      .select({
        attendeeName: registration.attendeeName,
        eventName: event.name,
        eventSlug: event.slug,
        eventTimeZone: event.eventTimeZone,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        venueName: event.venueName,
        venueAddress: event.venueAddress,
        ticketCode: ticket.code,
        ticketJws: ticket.signedPayload,
      })
      .from(registration)
      .innerJoin(event, eq(event.id, registration.eventId))
      .innerJoin(
        ticket,
        and(eq(ticket.registrationId, registration.id), eq(ticket.status, "active")),
      )
      .where(
        and(
          eq(registration.managementTokenDigest, digestBearerToken(managementToken)),
          eq(registration.status, "confirmed"),
        ),
      )
      .limit(1);
    return view
      ? {
          attendeeName: view.attendeeName,
          event: {
            name: view.eventName,
            slug: view.eventSlug,
            eventTimeZone: view.eventTimeZone,
            startsAt: view.startsAt,
            endsAt: view.endsAt,
            venueName: view.venueName,
            venueAddress: view.venueAddress,
          },
          ticketCode: view.ticketCode,
          ticketJws: view.ticketJws,
        }
      : null;
  }

  async function getManagementView(
    managementToken: string,
  ): Promise<RegistrationManagementView | null> {
    if (!isWellFormedCapability(managementToken)) return null;
    const [record] = await database
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
      })
      .from(registration)
      .innerJoin(event, eq(event.id, registration.eventId))
      .where(
        and(
          eq(registration.managementTokenDigest, digestBearerToken(managementToken)),
          inArray(registration.status, ["confirmed", "canceled"]),
        ),
      )
      .limit(1);
    if (!record) return null;

    const [latestTicket] = await database
      .select({
        status: ticket.status,
        code: ticket.code,
        signedPayload: ticket.signedPayload,
      })
      .from(ticket)
      .where(eq(ticket.registrationId, record.registrationId))
      .orderBy(desc(ticket.createdAt), desc(ticket.id))
      .limit(1);

    const fieldRows = await database
      .select({
        id: registrationField.id,
        answerType: registrationField.answerType,
        label: registrationField.label,
        helpText: registrationField.helpText,
        required: registrationField.required,
        value: registrationAnswer.value,
      })
      .from(registrationField)
      .leftJoin(
        registrationAnswer,
        and(
          eq(registrationAnswer.fieldId, registrationField.id),
          eq(registrationAnswer.registrationId, record.registrationId),
        ),
      )
      .where(
        and(
          eq(registrationField.eventId, record.eventId),
          eq(registrationField.archived, false),
        ),
      )
      .orderBy(asc(registrationField.position), asc(registrationField.id));

    const fieldIds = fieldRows.map(({ id }) => id);
    const choiceRows = fieldIds.length
      ? await database
          .select({
            id: registrationFieldChoice.id,
            fieldId: registrationFieldChoice.fieldId,
            label: registrationFieldChoice.label,
          })
          .from(registrationFieldChoice)
          .where(
            and(
              inArray(registrationFieldChoice.fieldId, fieldIds),
              eq(registrationFieldChoice.archived, false),
            ),
          )
          .orderBy(asc(registrationFieldChoice.position), asc(registrationFieldChoice.id))
      : [];
    const viewedAt = now();
    const fields = fieldRows.map((field) => ({
      id: field.id,
      answerType: field.answerType as PublicRegistrationField["answerType"],
      label: field.label,
      helpText: field.helpText,
      required: field.required,
      choices: choiceRows
        .filter(({ fieldId }) => fieldId === field.id)
        .map(({ id, label }) => ({ id, label })),
      value: (field.value ?? null) as string | string[] | boolean | null,
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
        record.checkInOpensAt > viewedAt,
    };
  }

  async function updateRegistration(
    managementToken: string,
    values: { name: string; answers: Record<string, unknown> },
  ): Promise<UpdateRegistrationResult> {
    if (!isWellFormedCapability(managementToken)) return { outcome: "invalid" };
    const updatedAt = now();
    return database.transaction(async (transaction) => {
      const [managed] = await transaction
        .select({
          id: registration.id,
          eventId: registration.eventId,
          email: registration.email,
          status: registration.status,
          registrationClosesAt: event.registrationClosesAt,
          suspended: event.suspended,
        })
        .from(registration)
        .innerJoin(event, eq(event.id, registration.eventId))
        .where(
          eq(registration.managementTokenDigest, digestBearerToken(managementToken)),
        )
        .for("update")
        .limit(1);
      if (!managed) return { outcome: "invalid" } as const;
      assertEventNotSuspended(managed);
      await lockEventForMutation(transaction, managed.eventId);
      if (
        managed.status !== "confirmed" ||
        managed.registrationClosesAt <= updatedAt
      ) {
        return { outcome: "closed" } as const;
      }

      const fieldRows = await transaction
        .select({
          id: registrationField.id,
          answerType: registrationField.answerType,
          label: registrationField.label,
          helpText: registrationField.helpText,
          required: registrationField.required,
        })
        .from(registrationField)
        .where(
          and(
            eq(registrationField.eventId, managed.eventId),
            eq(registrationField.archived, false),
          ),
        )
        .orderBy(asc(registrationField.position), asc(registrationField.id));
      const fieldIds = fieldRows.map(({ id }) => id);
      const choices = fieldIds.length
        ? await transaction
            .select({
              id: registrationFieldChoice.id,
              fieldId: registrationFieldChoice.fieldId,
              label: registrationFieldChoice.label,
            })
            .from(registrationFieldChoice)
            .where(
              and(
                inArray(registrationFieldChoice.fieldId, fieldIds),
                eq(registrationFieldChoice.archived, false),
              ),
            )
            .orderBy(asc(registrationFieldChoice.position), asc(registrationFieldChoice.id))
        : [];
      const fields: PublicRegistrationField[] = fieldRows.map((field) => ({
        ...field,
        answerType: field.answerType as PublicRegistrationField["answerType"],
        choices: choices
          .filter(({ fieldId }) => fieldId === field.id)
          .map(({ id, label }) => ({ id, label })),
      }));
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
      for (const [fieldId, value] of Object.entries(validation.data.answers)) {
        await transaction
          .insert(registrationAnswer)
          .values({ registrationId: managed.id, fieldId, value })
          .onConflictDoUpdate({
            target: [registrationAnswer.registrationId, registrationAnswer.fieldId],
            set: { value, updatedAt },
          });
      }
      return { outcome: "updated" } as const;
    });
  }

  async function resendTicket(managementToken: string): Promise<TicketManagementResult> {
    if (!isWellFormedCapability(managementToken)) {
      return { outcome: "invalid" };
    }

    const previousManagementTokenDigest = digestBearerToken(managementToken);
    let emailMessage: TicketEmail | null = null;
    let result: TicketManagementResult;

    try {
      result = await database.transaction(async (transaction) => {
        const [located] = await transaction
          .select({ eventId: registration.eventId })
          .from(registration)
          .where(
            eq(registration.managementTokenDigest, previousManagementTokenDigest),
          )
          .limit(1);
        if (!located) return { outcome: "invalid" } as const;

        const lockedEvent = await lockEventForMutation(transaction, located.eventId);
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
              eq(registration.managementTokenDigest, previousManagementTokenDigest),
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

        const rotatedAt = now();
        if (
          await isTicketEmailLimited(transaction, {
            eventId: managed.eventId,
            email: managed.email,
            at: rotatedAt,
          })
        ) {
          return { outcome: "throttled" } as const;
        }

        const newManagementToken = createManagementToken();
        const [rotated] = await transaction
          .update(registration)
          .set({
            managementTokenDigest: digestBearerToken(newManagementToken),
            updatedAt: rotatedAt,
          })
          .where(
            and(
              eq(registration.id, managed.registrationId),
              eq(registration.managementTokenDigest, previousManagementTokenDigest),
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
      await sendTicketEmail(emailMessage);
      return result;
    } catch {
      return { ...result, deliveryStatus: "failed" };
    }
  }

  async function replaceTicket(managementToken: string): Promise<TicketManagementResult> {
    if (!isWellFormedCapability(managementToken)) return { outcome: "invalid" };
    const replacedAt = now();
    const signingKey = getSigningKey();
    let emailMessage: TicketEmail | null = null;
    const result = await database.transaction(async (transaction) => {
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
          checkInOpensAt: event.checkInOpensAt,
          suspended: event.suspended,
        })
        .from(registration)
        .innerJoin(event, eq(event.id, registration.eventId))
        .where(
          eq(registration.managementTokenDigest, digestBearerToken(managementToken)),
        )
        .for("update")
        .limit(1);
      if (!managed) return { outcome: "invalid" } as const;
      assertEventNotSuspended(managed);
      await lockEventForMutation(transaction, managed.eventId);
      if (managed.registrationStatus !== "confirmed") {
        return { outcome: "inactive" } as const;
      }
      if (managed.checkInOpensAt <= replacedAt) return { outcome: "closed" } as const;
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

      let ticketCode: string | null = null;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const candidate = createTicketCode();
        const [existing] = await transaction
          .select({ id: ticket.id })
          .from(ticket)
          .where(and(eq(ticket.eventId, managed.eventId), eq(ticket.code, candidate)))
          .limit(1);
        if (!existing) {
          ticketCode = candidate;
          break;
        }
      }
      if (!ticketCode) throw new Error("Could not allocate a unique Ticket Code.");
      const ticketId = createTicketId();
      const ticketJws = signTicket({ eventId: managed.eventId, ticketId }, signingKey);
      await transaction
        .update(ticket)
        .set({ status: "replaced", invalidatedAt: replacedAt })
        .where(and(eq(ticket.id, activeTicket.id), eq(ticket.status, "active")));
      await transaction.insert(ticket).values({
        id: ticketId,
        eventId: managed.eventId,
        registrationId: managed.registrationId,
        code: ticketCode,
        signedPayload: ticketJws,
        signingKeyId: signingKey.id,
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
      return { outcome: "replaced" } as const;
    });
    if (result.outcome !== "replaced" || !emailMessage) return result;
    try {
      await sendTicketEmail(emailMessage);
      return { ...result, deliveryStatus: "sent" };
    } catch {
      return { ...result, deliveryStatus: "failed" };
    }
  }

  async function cancelRegistration(
    managementToken: string,
  ): Promise<TicketManagementResult> {
    if (!isWellFormedCapability(managementToken)) return { outcome: "invalid" };
    const canceledAt = now();
    let offerMessages: AdmissionOfferMessage[] = [];
    const result = await database.transaction(async (transaction) => {
      const [managed] = await transaction
        .select({
          registrationId: registration.id,
          registrationStatus: registration.status,
          eventId: event.id,
          checkInOpensAt: event.checkInOpensAt,
          suspended: event.suspended,
        })
        .from(registration)
        .innerJoin(event, eq(event.id, registration.eventId))
        .where(
          eq(registration.managementTokenDigest, digestBearerToken(managementToken)),
        )
        .for("update")
        .limit(1);
      if (!managed) return { outcome: "invalid" } as const;
      assertEventNotSuspended(managed);
      await lockEventForMutation(transaction, managed.eventId);
      if (managed.registrationStatus !== "confirmed") {
        return { outcome: "inactive" } as const;
      }
      if (managed.checkInOpensAt <= canceledAt) return { outcome: "closed" } as const;
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
      if (invalidatedTickets.length !== 1) return { outcome: "inactive" } as const;
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
        createOfferToken,
      });
      return { outcome: "canceled" } as const;
    });
    await deliverAdmissionOfferMessages(offerMessages, sendAdmissionOfferEmail);
    return result;
  }

  return {
    verifyRegistration,
    claimAdmissionOffer,
    getAdmissionOfferView,
    reconcileEventWaitlist,
    getTicketView,
    getManagementView,
    updateRegistration,
    resendTicket,
    replaceTicket,
    cancelRegistration,
  };
}
