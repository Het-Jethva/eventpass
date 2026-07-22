import { createHash, randomBytes, randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import {
  admissionOffer,
  capacityHold,
  event,
  registration,
  registrationVerification,
  ticket,
} from "../../../lib/db/schema";
import {
  reconcileWaitlistInTransaction,
  type AdmissionOfferMessage,
} from "../../registration/server/waitlist-reconciliation";
import { createTicketCode as createRandomTicketCode } from "../ticket-code";
import { signTicket } from "../ticket-crypto";

type TicketDatabase = typeof import("../../../lib/db").db;

type SigningKey = Parameters<typeof signTicket>[1];

type TicketEmail = {
  email: string;
  attendeeName: string;
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
  | { outcome: "waitlisted" | "offered" }
  | { outcome: "expired" | "consumed" | "invalid" | "mismatched" };

export type AdmissionOfferClaimResult =
  | {
      outcome: "confirmed";
      managementToken: string;
      ticketId: string;
      deliveryStatus: "sent" | "failed";
    }
  | { outcome: "expired" | "consumed" | "invalid" };

export type AdmissionOfferView = {
  attendeeName: string;
  eventName: string;
  eventSlug: string;
  expiresAt: Date;
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
          eventTimeZone: event.eventTimeZone,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          venueName: event.venueName,
          venueAddress: event.venueAddress,
        })
        .from(event)
        .where(eq(event.slug, eventSlug))
        .for("update")
        .limit(1);
      if (!lockedEvent) return { outcome: "mismatched" } as const;

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

    for (const message of offerMessages) {
      try {
        await sendAdmissionOfferEmail(message);
      } catch {
        // Domain state is committed independently from delivery outcomes.
      }
    }
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

    const result = await database.transaction(async (transaction) => {
      const [located] = await transaction
        .select({ eventId: registration.eventId })
        .from(admissionOffer)
        .innerJoin(registration, eq(registration.id, admissionOffer.registrationId))
        .where(eq(admissionOffer.tokenDigest, digestBearerToken(offerToken)))
        .limit(1);
      if (!located) return { outcome: "invalid" } as const;

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

    for (const message of promotedMessages) {
      try {
        await sendAdmissionOfferEmail(message);
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
      promotedMessages = await reconcileWaitlistInTransaction({
        transaction,
        eventId: located.eventId,
        reconciledAt: viewedAt,
        createOfferToken,
      });
      const [activeOffer] = await transaction
        .select({
          attendeeName: registration.attendeeName,
          eventName: event.name,
          eventSlug: event.slug,
          expiresAt: admissionOffer.expiresAt,
        })
        .from(admissionOffer)
        .innerJoin(registration, eq(registration.id, admissionOffer.registrationId))
        .innerJoin(event, eq(event.id, registration.eventId))
        .where(
          and(
            eq(admissionOffer.tokenDigest, digestBearerToken(offerToken)),
            eq(admissionOffer.status, "active"),
            eq(registration.status, "waitlisted"),
          ),
        )
        .limit(1);
      return activeOffer ?? null;
    });
    for (const message of promotedMessages) {
      try {
        await sendAdmissionOfferEmail(message);
      } catch {
        // Domain state is committed independently from delivery outcomes.
      }
    }
    return view;
  }

  async function reconcileEventWaitlist(eventId: string) {
    const reconciledAt = now();
    const messages = await database.transaction((transaction) =>
      reconcileWaitlistInTransaction({
        transaction,
        eventId,
        reconciledAt,
        createOfferToken,
      }),
    );
    for (const message of messages) {
      try {
        await sendAdmissionOfferEmail(message);
      } catch {
        // Domain state is committed independently from delivery outcomes.
      }
    }
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

  return {
    verifyRegistration,
    claimAdmissionOffer,
    getAdmissionOfferView,
    reconcileEventWaitlist,
    getTicketView,
  };
}
