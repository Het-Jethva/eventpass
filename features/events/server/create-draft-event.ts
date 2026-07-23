import "server-only";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../../lib/db";
import { event, eventStaff, user } from "../../../lib/db/schema";

import {
  isIanaTimeZone,
  localDateTimeInTimeZoneToUtc,
} from "./event-schedule";

const localDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose a valid date and time.");

export const createDraftEventInputSchema = z
  .object({
    name: z.string().trim().min(1, "Enter an Event name.").max(160),
    description: z
      .string()
      .trim()
      .min(1, "Enter an Event description.")
      .max(4_000),
    slug: z
      .string()
      .trim()
      .min(3, "Use at least 3 characters.")
      .max(80)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Use lowercase letters, numbers, and single hyphens.",
      ),
    eventTimeZone: z
      .string()
      .trim()
      .min(1, "Enter an Event Time Zone.")
      .refine(isIanaTimeZone, "Enter a valid IANA time zone, such as Asia/Kolkata."),
    startsAtLocal: localDateTime,
    endsAtLocal: localDateTime,
    venueName: z.string().trim().min(1, "Enter a Venue name.").max(160),
    venueAddress: z.string().trim().min(1, "Enter the Venue address.").max(500),
    venueMapUrl: z
      .union([z.literal(""), z.url("Enter a valid map URL.")])
      .transform((value) => value || null),
    capacity: z.coerce
      .number()
      .int("Capacity must be a whole number.")
      .min(1, "Capacity must be at least 1.")
      .max(1_000_000, "Capacity cannot exceed 1,000,000."),
    registrationOpensAtLocal: localDateTime,
    registrationClosesAtLocal: localDateTime,
    checkInOpensAtLocal: localDateTime,
    checkInClosesAtLocal: localDateTime,
  })
  .superRefine((input, context) => {
    const dateFields = [
      "startsAtLocal",
      "endsAtLocal",
      "registrationOpensAtLocal",
      "registrationClosesAtLocal",
      "checkInOpensAtLocal",
      "checkInClosesAtLocal",
    ] as const;
    const dates = Object.fromEntries(
      dateFields.map((field) => [
        field,
        localDateTimeInTimeZoneToUtc(input[field], input.eventTimeZone),
      ]),
    ) as Record<(typeof dateFields)[number], Date | null>;

    for (const field of dateFields) {
      if (!dates[field]) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: "This local time does not exist in the Event Time Zone.",
        });
      }
    }

    if (dates.startsAtLocal && dates.endsAtLocal && dates.startsAtLocal >= dates.endsAtLocal) {
      context.addIssue({
        code: "custom",
        path: ["endsAtLocal"],
        message: "The Event must end after it starts.",
      });
    }

    if (
      dates.registrationOpensAtLocal &&
      dates.registrationClosesAtLocal &&
      dates.registrationOpensAtLocal >= dates.registrationClosesAtLocal
    ) {
      context.addIssue({
        code: "custom",
        path: ["registrationClosesAtLocal"],
        message: "Registration must close after it opens.",
      });
    }

    if (
      dates.registrationClosesAtLocal &&
      dates.startsAtLocal &&
      dates.registrationClosesAtLocal > dates.startsAtLocal
    ) {
      context.addIssue({
        code: "custom",
        path: ["registrationClosesAtLocal"],
        message: "Registration cannot close after the Event starts.",
      });
    }

    if (
      dates.checkInOpensAtLocal &&
      dates.checkInClosesAtLocal &&
      dates.checkInOpensAtLocal >= dates.checkInClosesAtLocal
    ) {
      context.addIssue({
        code: "custom",
        path: ["checkInClosesAtLocal"],
        message: "Check-in must close after it opens.",
      });
    }

    if (
      dates.checkInOpensAtLocal &&
      dates.endsAtLocal &&
      dates.checkInOpensAtLocal > dates.endsAtLocal
    ) {
      context.addIssue({
        code: "custom",
        path: ["checkInOpensAtLocal"],
        message: "Check-in must open before the Event ends.",
      });
    }

    if (
      dates.checkInClosesAtLocal &&
      dates.startsAtLocal &&
      dates.checkInClosesAtLocal < dates.startsAtLocal
    ) {
      context.addIssue({
        code: "custom",
        path: ["checkInClosesAtLocal"],
        message: "Check-in must remain open until the Event starts.",
      });
    }
  });

export type CreateDraftEventInput = z.input<typeof createDraftEventInputSchema>;

export class StaffCannotCreateEventError extends Error {}

export async function createDraftEvent(
  actorUserId: string,
  rawInput: unknown,
) {
  const input = createDraftEventInputSchema.parse(rawInput);
  const startsAt = localDateTimeInTimeZoneToUtc(
    input.startsAtLocal,
    input.eventTimeZone,
  )!;
  const endsAt = localDateTimeInTimeZoneToUtc(input.endsAtLocal, input.eventTimeZone)!;
  const registrationOpensAt = localDateTimeInTimeZoneToUtc(
    input.registrationOpensAtLocal,
    input.eventTimeZone,
  )!;
  const registrationClosesAt = localDateTimeInTimeZoneToUtc(
    input.registrationClosesAtLocal,
    input.eventTimeZone,
  )!;
  const checkInOpensAt = localDateTimeInTimeZoneToUtc(
    input.checkInOpensAtLocal,
    input.eventTimeZone,
  )!;
  const checkInClosesAt = localDateTimeInTimeZoneToUtc(
    input.checkInClosesAtLocal,
    input.eventTimeZone,
  )!;

  return db.transaction(async (transaction) => {
    const [actor] = await transaction
      .select({ id: user.id })
      .from(user)
      .where(
        and(
          eq(user.id, actorUserId),
          eq(user.emailVerified, true),
          eq(user.suspended, false),
        ),
      )
      .limit(1);

    if (!actor) {
      throw new StaffCannotCreateEventError("The staff user cannot create Events.");
    }

    const [createdEvent] = await transaction
      .insert(event)
      .values({
        name: input.name,
        description: input.description,
        slug: input.slug,
        eventTimeZone: input.eventTimeZone,
        startsAt,
        endsAt,
        venueName: input.venueName,
        venueAddress: input.venueAddress,
        venueMapUrl: input.venueMapUrl,
        capacity: input.capacity,
        registrationOpensAt,
        registrationClosesAt,
        checkInOpensAt,
        checkInClosesAt,
      })
      .returning({ id: event.id });

    await transaction.insert(eventStaff).values({
      eventId: createdEvent.id,
      userId: actor.id,
      role: "owner",
    });

    return createdEvent;
  });
}
