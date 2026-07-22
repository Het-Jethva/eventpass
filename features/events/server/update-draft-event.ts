import "server-only";

import { and, eq, inArray, ne } from "drizzle-orm";

import { db } from "@/lib/db";
import { event, eventStaff } from "@/lib/db/schema";

import {
  createDraftEventInputSchema,
  type CreateDraftEventInput,
} from "./create-draft-event";
import { localDateTimeInTimeZoneToUtc } from "./event-schedule";

export const updateDraftEventInputSchema = createDraftEventInputSchema;
export type UpdateDraftEventInput = CreateDraftEventInput;

export class DraftEventNotEditableError extends Error {}
export class EventSlugUnavailableError extends Error {}
export class EventSlugImmutableError extends Error {}

export async function updateDraftEvent(
  eventId: string,
  actorUserId: string,
  rawInput: unknown,
) {
  const input = updateDraftEventInputSchema.parse(rawInput);

  return db.transaction(async (transaction) => {
    const [authorization] = await transaction
      .select({ id: event.id, slug: event.slug, publishedAt: event.publishedAt })
      .from(eventStaff)
      .innerJoin(event, eq(event.id, eventStaff.eventId))
      .where(
        and(
          eq(event.id, eventId),
          eq(event.status, "draft"),
          eq(eventStaff.userId, actorUserId),
          inArray(eventStaff.role, ["owner", "organizer"]),
        ),
      )
      .limit(1);

    if (!authorization) {
      throw new DraftEventNotEditableError(
        "Only an Organizer can edit a Draft Event.",
      );
    }

    if (authorization.publishedAt && authorization.slug !== input.slug) {
      throw new EventSlugImmutableError(
        "The Event Slug cannot change after first publication.",
      );
    }

    const [slugConflict] = await transaction
      .select({ id: event.id })
      .from(event)
      .where(and(eq(event.slug, input.slug), ne(event.id, eventId)))
      .limit(1);

    if (slugConflict) {
      throw new EventSlugUnavailableError("That Event Slug is already in use.");
    }

    const [updatedEvent] = await transaction
      .update(event)
      .set({
        name: input.name,
        description: input.description,
        slug: input.slug,
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
        updatedAt: new Date(),
      })
      .where(and(eq(event.id, eventId), eq(event.status, "draft")))
      .returning({ id: event.id });

    if (!updatedEvent) {
      throw new DraftEventNotEditableError(
        "The Event is no longer an editable Draft Event.",
      );
    }
  });
}
