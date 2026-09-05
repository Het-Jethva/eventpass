import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import {
  admissionOffer,
  auditEntry,
  capacityHold,
  emailDelivery,
  event,
  eventStaff,
  registration,
  ticket,
} from "../../../lib/db/schema";
import { createDraftEventInputSchema } from "./create-draft-event";
import { localDateTimeInTimeZoneToUtc } from "./event-schedule";
import {
  reconcileWaitlistInTransaction,
  type AdmissionOfferMessage,
} from "../../registration/server/waitlist-reconciliation";
import { deliverAdmissionOfferMessages } from "@/lib/email/deliver-admission-offers";
import {
  assertPostCheckInChangeAllowed,
  PublishedEventChangeError,
} from "../published-event-policy";
import { lockEventForMutation } from "./event-suspension";

export { PublishedEventChangeError } from "../published-event-policy";

type EventDatabase = typeof import("../../../lib/db").db;

type PublishedEventApplicationDependencies = {
  database: EventDatabase;
  deliverNotification?: (deliveryId: string) => Promise<void>;
  sendAdmissionOfferEmail?: (message: AdmissionOfferMessage) => Promise<void>;
  createOfferToken?: () => string;
  now?: () => Date;
};

type MaterialChange = {
  field: string;
  before: string | number | null;
  after: string | number | null;
};

export const cancelPublishedEventInputSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Explain why this Event is being canceled.")
    .max(1_000, "Keep the cancellation reason under 1,000 characters."),
});

export class PublishedEventAuthorizationError extends Error {}
export class EventCapacityConflictError extends Error {}
export class EventCancellationError extends Error {}

function iso(value: Date) {
  return value.toISOString();
}

function eventValues(input: z.output<typeof createDraftEventInputSchema>) {
  return {
    name: input.name,
    description: input.description,
    eventTimeZone: input.eventTimeZone,
    startsAt: localDateTimeInTimeZoneToUtc(
      input.startsAtLocal,
      input.eventTimeZone,
    )!,
    endsAt: localDateTimeInTimeZoneToUtc(
      input.endsAtLocal,
      input.eventTimeZone,
    )!,
    venueName: input.venueName,
    venueAddress: input.venueAddress,
    venueMapUrl: input.venueMapUrl,
    capacity: input.capacity,
    registrationOpensAt: localDateTimeInTimeZoneToUtc(
      input.registrationOpensAtLocal,
      input.eventTimeZone,
    )!,
    registrationClosesAt: localDateTimeInTimeZoneToUtc(
      input.registrationClosesAtLocal,
      input.eventTimeZone,
    )!,
    checkInOpensAt: localDateTimeInTimeZoneToUtc(
      input.checkInOpensAtLocal,
      input.eventTimeZone,
    )!,
    checkInClosesAt: localDateTimeInTimeZoneToUtc(
      input.checkInClosesAtLocal,
      input.eventTimeZone,
    )!,
  };
}

function materialChanges(
  current: {
    eventTimeZone: string;
    startsAt: Date;
    endsAt: Date;
    venueName: string;
    venueAddress: string;
    venueMapUrl: string | null;
    capacity: number;
    registrationOpensAt: Date;
    registrationClosesAt: Date;
    checkInOpensAt: Date;
    checkInClosesAt: Date;
  },
  next: ReturnType<typeof eventValues>,
) {
  const changes: MaterialChange[] = [];
  const add = (
    field: string,
    before: string | number | null,
    after: string | number | null,
  ) => {
    if (before !== after) changes.push({ field, before, after });
  };

  add("eventTimeZone", current.eventTimeZone, next.eventTimeZone);
  add("startsAt", iso(current.startsAt), iso(next.startsAt));
  add("endsAt", iso(current.endsAt), iso(next.endsAt));
  add("venueName", current.venueName, next.venueName);
  add("venueAddress", current.venueAddress, next.venueAddress);
  add("venueMapUrl", current.venueMapUrl, next.venueMapUrl);
  add("capacity", current.capacity, next.capacity);
  add(
    "registrationOpensAt",
    iso(current.registrationOpensAt),
    iso(next.registrationOpensAt),
  );
  add(
    "registrationClosesAt",
    iso(current.registrationClosesAt),
    iso(next.registrationClosesAt),
  );
  add(
    "checkInOpensAt",
    iso(current.checkInOpensAt),
    iso(next.checkInOpensAt),
  );
  add(
    "checkInClosesAt",
    iso(current.checkInClosesAt),
    iso(next.checkInClosesAt),
  );
  return changes;
}

async function dispatch(
  deliveryIds: string[],
  deliverNotification: (deliveryId: string) => Promise<void>,
) {
  await Promise.allSettled(deliveryIds.map(deliverNotification));
}

export function createPublishedEventApplicationService({
  database,
  deliverNotification = async () => undefined,
  sendAdmissionOfferEmail = async () => undefined,
  createOfferToken,
  now = () => new Date(),
}: PublishedEventApplicationDependencies) {
  async function updatePublishedEvent(
    eventId: string,
    actorUserId: string,
    rawInput: unknown,
  ) {
    const input = createDraftEventInputSchema.parse(rawInput);
    const changedAt = now();
    const next = eventValues(input);

    const result = await database.transaction(async (transaction) => {
      await lockEventForMutation(transaction, eventId);
      const [current] = await transaction
        .select({
          id: event.id,
          name: event.name,
          description: event.description,
          slug: event.slug,
          status: event.status,
          eventTimeZone: event.eventTimeZone,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          venueName: event.venueName,
          venueAddress: event.venueAddress,
          venueMapUrl: event.venueMapUrl,
          capacity: event.capacity,
          registrationOpensAt: event.registrationOpensAt,
          registrationClosesAt: event.registrationClosesAt,
          checkInOpensAt: event.checkInOpensAt,
          checkInClosesAt: event.checkInClosesAt,
          role: eventStaff.role,
        })
        .from(event)
        .innerJoin(
          eventStaff,
          and(
            eq(eventStaff.eventId, event.id),
            eq(eventStaff.userId, actorUserId),
          ),
        )
        .where(eq(event.id, eventId))
        .limit(1);

      if (
        !current ||
        !["owner", "organizer"].includes(current.role) ||
        current.status !== "published"
      ) {
        throw new PublishedEventAuthorizationError(
          "Only an Organizer can change a Published Event.",
        );
      }
      if (input.slug !== current.slug) {
        throw new PublishedEventChangeError(
          "The Event Slug cannot change after publication.",
        );
      }

      if (changedAt >= current.checkInOpensAt) {
        assertPostCheckInChangeAllowed(current, next);
      }

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
              and active_hold.expires_at > ${changedAt}
          )`,
          offers: sql<number>`(
            select count(*)::int from ${admissionOffer} as active_offer
            inner join ${registration} as offered_registration
              on offered_registration.id = active_offer.registration_id
            where offered_registration.event_id = ${eventId}
              and active_offer.status = 'active'
              and active_offer.expires_at > ${changedAt}
          )`,
        })
        .from(event)
        .where(eq(event.id, eventId))
        .limit(1);
      const claimedCapacity =
        (usage?.confirmed ?? 0) + (usage?.holds ?? 0) + (usage?.offers ?? 0);
      if (next.capacity < claimedCapacity) {
        throw new EventCapacityConflictError(
          `Event Capacity cannot be lower than the ${claimedCapacity} existing claims.`,
        );
      }

      const changes = materialChanges(current, next);
      await transaction
        .update(event)
        .set({ ...next, updatedAt: changedAt })
        .where(and(eq(event.id, eventId), eq(event.status, "published")));

      const offerMessages =
        next.capacity > current.capacity
          ? await reconcileWaitlistInTransaction({
              transaction,
              eventId,
              reconciledAt: changedAt,
              createOfferToken,
            })
          : [];

      if (changes.length === 0) {
        return { deliveryIds: [], changes, offerMessages };
      }

      await transaction.insert(auditEntry).values({
        eventId,
        actorUserId,
        action: "event.material_change",
        targetType: "event",
        targetId: eventId,
        metadata: { changes },
        createdAt: changedAt,
      });
      const recipients = await transaction
        .select({ email: registration.email })
        .from(registration)
        .where(
          and(
            eq(registration.eventId, eventId),
            inArray(registration.status, ["confirmed", "waitlisted"]),
          ),
        );
      if (recipients.length === 0) {
        return { deliveryIds: [], changes, offerMessages };
      }
      const deliveries = await transaction
        .insert(emailDelivery)
        .values(
          recipients.map(({ email }) => ({
            template: "event-material-change-v1",
            recipient: email,
            provider: "resend",
            eventId,
            outcome: "pending",
            metadata: {
              kind: "material_change",
              eventId,
              eventName: current.name,
              // The zone the Event is in after this change, so a changed
              // schedule is read against the clock Attendees will actually use.
              eventTimeZone: next.eventTimeZone,
              changes,
            },
          })),
        )
        .returning({ id: emailDelivery.id });
      return {
        deliveryIds: deliveries.map(({ id }) => id),
        changes,
        offerMessages,
      };
    });

    await Promise.all([
      dispatch(result.deliveryIds, deliverNotification),
      deliverAdmissionOfferMessages(result.offerMessages, sendAdmissionOfferEmail),
    ]);
    return { materialChanges: result.changes.length };
  }

  async function cancelPublishedEvent(
    eventId: string,
    actorUserId: string,
    rawInput: unknown,
  ) {
    const input = cancelPublishedEventInputSchema.parse(rawInput);
    const canceledAt = now();
    const result = await database.transaction(async (transaction) => {
      await lockEventForMutation(transaction, eventId);
      const [current] = await transaction
        .select({
          id: event.id,
          name: event.name,
          status: event.status,
          role: eventStaff.role,
        })
        .from(event)
        .innerJoin(
          eventStaff,
          and(
            eq(eventStaff.eventId, event.id),
            eq(eventStaff.userId, actorUserId),
          ),
        )
        .where(eq(event.id, eventId))
        .limit(1);
      if (!current || current.role !== "owner") {
        throw new PublishedEventAuthorizationError(
          "Only the Event Owner can cancel this Event.",
        );
      }
      if (current.status !== "published") {
        throw new EventCancellationError(
          current.status === "canceled"
            ? "A canceled Event cannot be restored or canceled again."
            : "Only a Published Event can be canceled.",
        );
      }

      await transaction
        .update(event)
        .set({
          status: "canceled",
          canceledAt,
          cancellationReason: input.reason,
          updatedAt: canceledAt,
        })
        .where(and(eq(event.id, eventId), eq(event.status, "published")));
      await transaction
        .update(ticket)
        .set({
          status: "canceled",
          invalidatedAt: canceledAt,
        })
        .where(and(eq(ticket.eventId, eventId), eq(ticket.status, "active")));
      await transaction
        .update(admissionOffer)
        .set({ status: "expired" })
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
      await transaction.insert(auditEntry).values({
        eventId,
        actorUserId,
        action: "event.canceled",
        targetType: "event",
        targetId: eventId,
        reason: input.reason,
        metadata: {},
        createdAt: canceledAt,
      });

      const recipients = await transaction
        .select({ email: registration.email })
        .from(registration)
        .where(
          and(
            eq(registration.eventId, eventId),
            inArray(registration.status, ["confirmed", "waitlisted"]),
          ),
        );
      if (recipients.length === 0) return [];
      const deliveries = await transaction
        .insert(emailDelivery)
        .values(
          recipients.map(({ email }) => ({
            template: "event-canceled-v1",
            recipient: email,
            provider: "resend",
            eventId,
            outcome: "pending",
            metadata: {
              kind: "cancellation",
              eventId,
              eventName: current.name,
              reason: input.reason,
            },
          })),
        )
        .returning({ id: emailDelivery.id });
      return deliveries.map(({ id }) => id);
    });

    await dispatch(result, deliverNotification);
    return { outcome: "canceled" as const };
  }

  return { updatePublishedEvent, cancelPublishedEvent };
}
