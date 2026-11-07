import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { getOrganizerEvent } from "@/features/events/server/get-event";
import { digestBearerToken, isBearerToken } from "@/lib/bearer-token-digest";
import { db } from "@/lib/db";
import { deliverAdmissionOfferMessages } from "@/lib/email/deliver-admission-offers";
import { sendAdmissionOffer } from "@/lib/email/send-admission-offer";
import { sendTicket } from "@/lib/email/send-ticket";
import { sendWaitlistConfirmation } from "@/lib/email/send-waitlist-confirmation";

import {
  admissionOffer,
  capacityHold,
  event,
  registration,
  registrationVerification,
} from "../../../lib/db/schema";
import {
  EventSuspendedError,
  isEventSuspended,
  lockEvent,
  lockEventForMutation,
} from "../../events/server/event-suspension";
import {
  reconcileWaitlistInTransaction,
  type AdmissionOfferMessage,
} from "../../registration/server/waitlist-reconciliation";
import { issueTicket } from "./ticket-issuance";
import { getActiveTicketSigningKey } from "./ticket-signing-config";

type TicketEmail = Parameters<typeof sendTicket>[0];

export type RegistrationVerificationResult =
  | {
      outcome: "confirmed";
      managementToken: string;
      ticketId: string;
      deliveryStatus: "sent" | "failed";
    }
  | { outcome: "waitlisted"; deliveryStatus?: "failed" }
  | { outcome: "unavailable" }
  | { outcome: "offered"; offerToken: string }
  | { outcome: "expired" | "consumed" | "invalid" | "mismatched" | "canceled" };

export type AdmissionOfferClaimResult =
  | {
      outcome: "confirmed";
      managementToken: string;
      ticketId: string;
      deliveryStatus: "sent" | "failed";
    }
  | {
      outcome: "expired" | "consumed" | "invalid" | "canceled" | "unavailable";
    };

export type AdmissionOfferView = {
  attendeeName: string;
  eventName: string;
  eventSlug: string;
  eventTimeZone: string;
  expiresAt: Date;
  suspended: boolean;
};

export async function verifyRegistration(
  eventSlug: string,
  verificationToken: string,
): Promise<RegistrationVerificationResult> {
  if (!isBearerToken(verificationToken)) return { outcome: "invalid" };
  const verifiedAt = new Date();
  const managementToken = randomBytes(32).toString("base64url");
  const ticketId = randomUUID();
  let emailMessage: TicketEmail | null = null;
  let offerMessages: AdmissionOfferMessage[] = [];
  let waitlistMessage: Parameters<typeof sendWaitlistConfirmation>[0] | null =
    null;

  const result = await db.transaction(async (transaction) => {
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
      .innerJoin(
        registration,
        eq(registration.id, registrationVerification.registrationId),
      )
      .where(
        eq(
          registrationVerification.tokenDigest,
          digestBearerToken(verificationToken),
        ),
      )
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
        offerMessages = await reconcileWaitlistInTransaction({
          transaction,
          eventId: lockedEvent.id,
          reconciledAt: verifiedAt,
        });
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
      });
      const matchingOffer = offerMessages.find(
        ({ email }) => email === capability.email,
      );
      if (!matchingOffer) {
        waitlistMessage = {
          email: capability.email,
          attendeeName: capability.attendeeName,
          eventId: lockedEvent.id,
          eventName: lockedEvent.name,
        };
        return { outcome: "waitlisted" } as const;
      }
      return {
        outcome: "offered",
        offerToken: matchingOffer.token,
      } as const;
    }

    if (capability.capacityOutcome !== "capacity_hold") {
      return { outcome: "mismatched" } as const;
    }

    const [hold] = await transaction
      .select({
        id: capacityHold.id,
        expiresAt: capacityHold.expiresAt,
        claimedAt: capacityHold.claimedAt,
      })
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
      offerMessages = await reconcileWaitlistInTransaction({
        transaction,
        eventId: lockedEvent.id,
        reconciledAt: verifiedAt,
      });
      return { outcome: "expired" } as const;
    }
    if (hold.claimedAt) return { outcome: "consumed" } as const;

    const { ticketCode, ticketJws } = await issueTicket({
      transaction,
      eventId: lockedEvent.id,
      registrationId: capability.registrationId,
      ticketId,
      signingKey: getActiveTicketSigningKey(),
    });
    await transaction
      .update(capacityHold)
      .set({ claimedAt: verifiedAt })
      .where(
        and(
          eq(capacityHold.id, hold.id),
          eq(capacityHold.registrationId, capability.registrationId),
        ),
      );
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

  await deliverAdmissionOfferMessages(offerMessages, sendAdmissionOffer);
  if (waitlistMessage) {
    try {
      await sendWaitlistConfirmation(waitlistMessage);
    } catch {
      if (result.outcome === "waitlisted") {
        return { outcome: "waitlisted", deliveryStatus: "failed" };
      }
    }
  }
  if (result.outcome !== "confirmed" || !emailMessage) return result;
  try {
    await sendTicket(emailMessage);
    return result;
  } catch {
    return { ...result, deliveryStatus: "failed" };
  }
}

export async function claimAdmissionOffer(
  offerToken: string,
): Promise<AdmissionOfferClaimResult> {
  if (!isBearerToken(offerToken)) return { outcome: "invalid" };
  const claimedAt = new Date();
  const managementToken = randomBytes(32).toString("base64url");
  const ticketId = randomUUID();
  let emailMessage: TicketEmail | null = null;
  let promotedMessages: AdmissionOfferMessage[] = [];

  let result: AdmissionOfferClaimResult;
  try {
    result = await db.transaction(async (transaction) => {
      const [located] = await transaction
        .select({ eventId: registration.eventId })
        .from(admissionOffer)
        .innerJoin(
          registration,
          eq(registration.id, admissionOffer.registrationId),
        )
        .where(eq(admissionOffer.tokenDigest, digestBearerToken(offerToken)))
        .limit(1);
      if (!located) return { outcome: "invalid" } as const;

      const lockedEvent = await lockEventForMutation(
        transaction,
        located.eventId,
      );
      if (!lockedEvent) return { outcome: "invalid" } as const;

      promotedMessages = await reconcileWaitlistInTransaction({
        transaction,
        eventId: located.eventId,
        reconciledAt: claimedAt,
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
        .innerJoin(
          registration,
          eq(registration.id, admissionOffer.registrationId),
        )
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
      if (
        offered.offerStatus === "claimed" ||
        offered.registrationStatus === "confirmed"
      ) {
        return { outcome: "consumed" } as const;
      }
      if (
        offered.offerStatus !== "active" ||
        offered.registrationStatus !== "waitlisted" ||
        offered.expiresAt <= claimedAt
      ) {
        return { outcome: "expired" } as const;
      }

      const { ticketCode, ticketJws } = await issueTicket({
        transaction,
        eventId: offered.eventId,
        registrationId: offered.registrationId,
        ticketId,
        signingKey: getActiveTicketSigningKey(),
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

  await deliverAdmissionOfferMessages(promotedMessages, sendAdmissionOffer);
  if (result.outcome !== "confirmed" || !emailMessage) return result;
  try {
    await sendTicket(emailMessage);
    return result;
  } catch {
    return { ...result, deliveryStatus: "failed" };
  }
}

export async function getAdmissionOfferView(
  offerToken: string,
): Promise<AdmissionOfferView | null> {
  if (!isBearerToken(offerToken)) return null;
  const viewedAt = new Date();
  let promotedMessages: AdmissionOfferMessage[] = [];
  const view = await db.transaction(async (transaction) => {
    const [located] = await transaction
      .select({ eventId: registration.eventId })
      .from(admissionOffer)
      .innerJoin(
        registration,
        eq(registration.id, admissionOffer.registrationId),
      )
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
      .innerJoin(
        registration,
        eq(registration.id, admissionOffer.registrationId),
      )
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
  await deliverAdmissionOfferMessages(promotedMessages, sendAdmissionOffer);
  return view;
}

async function reconcileEventWaitlist(eventId: string) {
  const reconciledAt = new Date();
  const messages = await db.transaction(async (transaction) => {
    await lockEventForMutation(transaction, eventId);
    return reconcileWaitlistInTransaction({
      transaction,
      eventId,
      reconciledAt,
    });
  });
  await deliverAdmissionOfferMessages(messages, sendAdmissionOffer);
  return { promoted: messages.length };
}
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
  return reconcileEventWaitlist(eventId);
}
