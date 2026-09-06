import "server-only";

import { randomBytes } from "node:crypto";

import { and, asc, eq, sql } from "drizzle-orm";

import {
  admissionOffer,
  event,
  registration,
} from "../../../lib/db/schema";
import { digestBearerToken } from "@/lib/bearer-token-digest";
import {
  expireLapsedCapacityClaims,
  getActiveCapacityUsage,
  getAdmissionOfferExpiry,
} from "@/features/events/server/capacity-ledger";

export { getAdmissionOfferExpiry } from "@/features/events/server/capacity-ledger";
export { clampActiveOffersToRegistrationWindow } from "@/features/events/server/capacity-ledger";

type Database = typeof import("../../../lib/db").db;
export type DatabaseTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];

export type AdmissionOfferMessage = {
  email: string;
  attendeeName: string;
  eventId: string;
  eventName: string;
  eventSlug: string;
  eventTimeZone: string;
  expiresAt: Date;
  token: string;
};

export async function reconcileWaitlistInTransaction({
  transaction,
  eventId,
  reconciledAt,
  createOfferToken = () => randomBytes(32).toString("base64url"),
}: {
  transaction: DatabaseTransaction;
  eventId: string;
  reconciledAt: Date;
  createOfferToken?: () => string;
}): Promise<AdmissionOfferMessage[]> {
  const [lockedEvent] = await transaction
    .select({
      id: event.id,
      name: event.name,
      slug: event.slug,
      eventTimeZone: event.eventTimeZone,
      status: event.status,
      capacity: event.capacity,
      registrationClosesAt: event.registrationClosesAt,
      suspended: event.suspended,
    })
    .from(event)
    .where(eq(event.id, eventId))
    .for("update")
    .limit(1);
  if (!lockedEvent) return [];
  if (lockedEvent.suspended) return [];
  if (lockedEvent.status !== "published") return [];

  await expireLapsedCapacityClaims({ transaction, eventId, at: reconciledAt });

  if (lockedEvent.registrationClosesAt <= reconciledAt) return [];

  const usage = await getActiveCapacityUsage(
    transaction,
    eventId,
    reconciledAt,
  );
  const available = Math.max(0, lockedEvent.capacity - usage.claimed);
  if (available === 0) return [];

  const candidates = await transaction
    .select({
      id: registration.id,
      email: registration.email,
      attendeeName: registration.attendeeName,
    })
    .from(registration)
    .where(
      and(
        eq(registration.eventId, eventId),
        eq(registration.status, "waitlisted"),
        sql`not exists (
          select 1 from ${admissionOffer}
          where ${admissionOffer.registrationId} = ${registration.id}
            and ${admissionOffer.status} = 'active'
        )`,
      ),
    )
    .orderBy(asc(registration.verifiedAt), asc(registration.id))
    .limit(available)
    .for("update");

  const expiresAt = getAdmissionOfferExpiry(
    reconciledAt,
    lockedEvent.registrationClosesAt,
  );
  const offers = candidates.map((candidate) => {
    const token = createOfferToken();
    return {
      row: {
        registrationId: candidate.id,
        tokenDigest: digestBearerToken(token),
        expiresAt,
      },
      message: {
        email: candidate.email,
        attendeeName: candidate.attendeeName,
        eventId: lockedEvent.id,
        eventName: lockedEvent.name,
        eventSlug: lockedEvent.slug,
        eventTimeZone: lockedEvent.eventTimeZone,
        expiresAt,
        token,
      },
    };
  });
  if (offers.length > 0) {
    await transaction
      .insert(admissionOffer)
      .values(offers.map(({ row }) => row));
  }
  return offers.map(({ message }) => message);
}
