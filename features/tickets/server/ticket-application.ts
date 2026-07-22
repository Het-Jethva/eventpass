import { createHash, randomBytes, randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import {
  capacityHold,
  event,
  registration,
  registrationVerification,
  ticket,
} from "../../../lib/db/schema";
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
  now?: () => Date;
  createManagementToken?: () => string;
  createTicketCode?: () => string;
  createTicketId?: () => string;
};

export type RegistrationVerificationResult =
  | {
      outcome: "confirmed";
      managementToken: string;
      ticketId: string;
      deliveryStatus: "sent" | "failed";
    }
  | { outcome: "expired" | "consumed" | "invalid" | "mismatched" };

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
  now = () => new Date(),
  createManagementToken = () => randomBytes(32).toString("base64url"),
  createTicketCode = createRandomTicketCode,
  createTicketId = randomUUID,
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
      if (capability.status !== "unconfirmed" || capability.capacityOutcome !== "capacity_hold") {
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

    if (result.outcome !== "confirmed" || !emailMessage) return result;
    try {
      await sendTicketEmail(emailMessage);
      return result;
    } catch {
      return { ...result, deliveryStatus: "failed" };
    }
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

  return { verifyRegistration, getTicketView };
}
