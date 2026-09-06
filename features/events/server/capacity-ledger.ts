import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import {
  admissionOffer,
  capacityHold,
  event,
  registration,
  registrationVerification,
} from "@/lib/db/schema";

type CapacityLedgerDatabase = typeof import("@/lib/db").db;
type CapacityLedgerTransaction = Parameters<
  Parameters<CapacityLedgerDatabase["transaction"]>[0]
>[0];
type CapacityLedgerReader = Pick<CapacityLedgerDatabase, "select">;

/**
 * Claimed Event Capacity: confirmed Registrations plus unexpired Capacity
 * Holds plus active Admission Offers. Every capacity decision in the product
 * reads this one shape, so "what counts as active" can only drift in one
 * module. See ADR 0005.
 */
export type ActiveCapacityUsage = {
  confirmed: number;
  holds: number;
  offers: number;
  claimed: number;
};

export function getAdmissionOfferExpiry(
  issuedAt: Date,
  registrationClosesAt: Date,
) {
  return new Date(
    Math.min(
      issuedAt.getTime() + 12 * 60 * 60_000,
      registrationClosesAt.getTime(),
    ),
  );
}

export async function getActiveCapacityUsage(
  reader: CapacityLedgerReader,
  eventId: string,
  at: Date,
): Promise<ActiveCapacityUsage> {
  const [usage] = await reader
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
          and active_hold.expires_at > ${at}
      )`,
      offers: sql<number>`(
        select count(*)::int from ${admissionOffer} as active_offer
        inner join ${registration} as offered_registration
          on offered_registration.id = active_offer.registration_id
        where offered_registration.event_id = ${eventId}
          and active_offer.status = 'active'
          and active_offer.expires_at > ${at}
      )`,
    })
    .from(event)
    .where(eq(event.id, eventId))
    .limit(1);
  const confirmed = usage?.confirmed ?? 0;
  const holds = usage?.holds ?? 0;
  const offers = usage?.offers ?? 0;
  return { confirmed, holds, offers, claimed: confirmed + holds + offers };
}

export function hasCapacityForNewClaim(
  usage: ActiveCapacityUsage,
  capacity: number,
) {
  return usage.claimed < capacity;
}

/**
 * A decrease that would displace an existing claim is rejected outright: a
 * place, once claimed, is not taken back by editing a number. Callers raise
 * their own domain error; the ledger only answers the question.
 */
export function decreaseDisplacesClaims(
  claimed: number,
  nextCapacity: number,
) {
  return nextCapacity < claimed;
}

export async function clampActiveOffersToRegistrationWindow({
  transaction,
  eventId,
  registrationClosesAt,
}: {
  transaction: CapacityLedgerTransaction;
  eventId: string;
  registrationClosesAt: Date;
}) {
  await transaction
    .update(admissionOffer)
    .set({
      expiresAt: sql`least(${admissionOffer.expiresAt}, ${registrationClosesAt})`,
    })
    .where(
      and(
        eq(admissionOffer.status, "active"),
        sql`exists (
          select 1 from ${registration}
          where ${registration.id} = ${admissionOffer.registrationId}
            and ${registration.eventId} = ${eventId}
        )`,
      ),
    );
}

/**
 * Expiry is evaluated on read, never by a scheduler: a lapsed Capacity Hold
 * or Admission Offer stops consuming Event Capacity the next time the Event
 * is touched. Returns the Registrations whose Admission Offers lapsed so the
 * caller can expire the Waitlist Entries behind them.
 */
export async function expireLapsedCapacityClaims({
  transaction,
  eventId,
  at,
}: {
  transaction: CapacityLedgerTransaction;
  eventId: string;
  at: Date;
}) {
  await transaction.execute(sql`
    update ${registration}
    set status = 'expired', updated_at = ${at}
    where ${registration.eventId} = ${eventId}
      and ${registration.status} = 'unconfirmed'
      and (
        exists (
          select 1 from ${capacityHold}
          where ${capacityHold.registrationId} = ${registration.id}
            and ${capacityHold.claimedAt} is null
            and ${capacityHold.expiresAt} <= ${at}
        )
        or exists (
          select 1 from ${registrationVerification}
          where ${registrationVerification.registrationId} = ${registration.id}
            and ${registrationVerification.consumedAt} is null
            and ${registrationVerification.expiresAt} <= ${at}
        )
      )
  `);

  const expiredOffers = await transaction
    .update(admissionOffer)
    .set({ status: "expired" })
    .where(
      and(
        eq(admissionOffer.status, "active"),
        sql`${admissionOffer.expiresAt} <= ${at}`,
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
      .set({ status: "expired", updatedAt: at })
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
  return { expiredOfferRegistrationIds: expiredOffers.map(({ registrationId }) => registrationId) };
}
