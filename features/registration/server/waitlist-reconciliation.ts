import { createHash, randomBytes } from "node:crypto";

import { and, asc, eq, inArray, sql } from "drizzle-orm";

import {
  admissionOffer,
  capacityHold,
  event,
  registration,
  registrationVerification,
} from "../../../lib/db/schema";

type Database = typeof import("../../../lib/db").db;
export type DatabaseTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];

export type AdmissionOfferMessage = {
  email: string;
  attendeeName: string;
  eventName: string;
  eventSlug: string;
  expiresAt: Date;
  token: string;
};

function digestBearerToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getAdmissionOfferExpiry(issuedAt: Date, registrationClosesAt: Date) {
  return new Date(
    Math.min(
      issuedAt.getTime() + 12 * 60 * 60_000,
      registrationClosesAt.getTime(),
    ),
  );
}

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
      capacity: event.capacity,
      registrationClosesAt: event.registrationClosesAt,
    })
    .from(event)
    .where(eq(event.id, eventId))
    .for("update")
    .limit(1);
  if (!lockedEvent) return [];

  await transaction.execute(sql`
    update ${registration}
    set status = 'expired', updated_at = ${reconciledAt}
    where ${registration.eventId} = ${eventId}
      and ${registration.status} = 'unconfirmed'
      and (
        exists (
          select 1 from ${capacityHold}
          where ${capacityHold.registrationId} = ${registration.id}
            and ${capacityHold.claimedAt} is null
            and ${capacityHold.expiresAt} <= ${reconciledAt}
        )
        or exists (
          select 1 from ${registrationVerification}
          where ${registrationVerification.registrationId} = ${registration.id}
            and ${registrationVerification.consumedAt} is null
            and ${registrationVerification.expiresAt} <= ${reconciledAt}
        )
      )
  `);

  const expiredOffers = await transaction
    .update(admissionOffer)
    .set({ status: "expired" })
    .where(
      and(
        eq(admissionOffer.status, "active"),
        sql`${admissionOffer.expiresAt} <= ${reconciledAt}`,
        sql`exists (
          select 1 from ${registration}
          where ${registration.id} = ${admissionOffer.registrationId}
            and ${registration.eventId} = ${eventId}
        )`,
      ),
    )
    .returning({ registrationId: admissionOffer.registrationId });
  if (expiredOffers.length > 0) {
    await transaction
      .update(registration)
      .set({ status: "expired", updatedAt: reconciledAt })
      .where(
        and(
          inArray(
            registration.id,
            expiredOffers.map(({ registrationId }) => registrationId),
          ),
          eq(registration.status, "waitlisted"),
        ),
      );
  }

  if (lockedEvent.registrationClosesAt <= reconciledAt) return [];

  const [usage] = await transaction
    .select({
      confirmed: sql<number>`(
        select count(*)::int from ${registration} as confirmed_registration
        where confirmed_registration.event_id = ${eventId}
          and confirmed_registration.status = 'confirmed'
      )`,
      holds: sql<number>`(
        select count(*)::int from ${capacityHold} as active_hold
        inner join ${registration} as held_registration
          on held_registration.id = active_hold.registration_id
        where held_registration.event_id = ${eventId}
          and active_hold.claimed_at is null
          and active_hold.expires_at > ${reconciledAt}
      )`,
      offers: sql<number>`(
        select count(*)::int from ${admissionOffer} as active_offer
        inner join ${registration} as offered_registration
          on offered_registration.id = active_offer.registration_id
        where offered_registration.event_id = ${eventId}
          and active_offer.status = 'active'
          and active_offer.expires_at > ${reconciledAt}
      )`,
    })
    .from(event)
    .where(eq(event.id, eventId));
  const available = Math.max(
    0,
    lockedEvent.capacity -
      ((usage?.confirmed ?? 0) + (usage?.holds ?? 0) + (usage?.offers ?? 0)),
  );
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
  const messages: AdmissionOfferMessage[] = [];
  for (const candidate of candidates) {
    const token = createOfferToken();
    await transaction.insert(admissionOffer).values({
      registrationId: candidate.id,
      tokenDigest: digestBearerToken(token),
      expiresAt,
    });
    messages.push({
      email: candidate.email,
      attendeeName: candidate.attendeeName,
      eventName: lockedEvent.name,
      eventSlug: lockedEvent.slug,
      expiresAt,
      token,
    });
  }
  return messages;
}
