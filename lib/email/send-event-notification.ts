import "server-only";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { emailDelivery } from "@/lib/db/schema";
import { EMAIL_BODY_STYLE } from "./shell";
import { escapeHtml } from "./escape-html";
import { formatEventInstant } from "@/lib/format-event-range";
import { EmailDeliveryError, sendEmail } from "./send-email";

const materialChangeSchema = z.object({
  kind: z.literal("material_change"),
  eventId: z.string(),
  eventName: z.string(),
  eventTimeZone: z.string(),
  changes: z.array(
    z.object({
      field: z.string(),
      before: z.union([z.string(), z.number(), z.null()]),
      after: z.union([z.string(), z.number(), z.null()]),
    }),
  ),
});

const cancellationSchema = z.object({
  kind: z.literal("cancellation"),
  eventId: z.string(),
  eventName: z.string(),
  reason: z.string(),
});

const notificationSchema = z.discriminatedUnion("kind", [
  materialChangeSchema,
  cancellationSchema,
]);

const FIELD_LABELS: Record<string, string> = {
  name: "Event name",
  description: "Description",
  eventTimeZone: "Event Time Zone",
  startsAt: "Event start",
  endsAt: "Event end",
  venueName: "Venue",
  venueAddress: "Venue address",
  venueMapUrl: "Map link",
  capacity: "Event Capacity",
  registrationOpensAt: "Registration opens",
  registrationClosesAt: "Registration closes",
  checkInOpensAt: "Check-in opens",
  checkInClosesAt: "Check-in closes",
};

/**
 * Renders one side of a Material Event Change. Instants are shown in the
 * Event Time Zone so "Event start: 9:00 AM -> 10:00 AM" reads the way the
 * Attendee will experience it; the zone abbreviation is included because the
 * zone itself can be one of the changed fields.
 */
function displayMaterialChangeValue(
  value: string | number | null,
  eventTimeZone: string,
) {
  if (value === null || value === "") return "Not set";
  if (typeof value === "number") return value.toLocaleString("en");
  const date = /^\d{4}-\d{2}-\d{2}T/.test(value) ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? formatEventInstant(date, eventTimeZone)
    : value;
}

function content(metadata: z.infer<typeof notificationSchema>) {
  if (metadata.kind === "cancellation") {
    return {
      subject: `${metadata.eventName} has been canceled`,
      html: `<div style="${EMAIL_BODY_STYLE}"><h1 style="font-size:24px">${escapeHtml(metadata.eventName)} has been canceled</h1><p>Your registration and its history are kept, but every ticket is now inactive and cannot be used for admission.</p><p><strong>Reason:</strong> ${escapeHtml(metadata.reason)}</p></div>`,
      text: `${metadata.eventName} has been canceled.\n\nYour registration and its history are kept, but every ticket is now inactive and cannot be used for admission.\n\nReason: ${metadata.reason}`,
    };
  }

  const eventTimeZone = metadata.eventTimeZone;
  const rows = metadata.changes.map((change) => {
    const label = FIELD_LABELS[change.field] ?? change.field;
    const before = displayMaterialChangeValue(change.before, eventTimeZone);
    const after = displayMaterialChangeValue(change.after, eventTimeZone);
    return {
      html: `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(before)} → ${escapeHtml(after)}</li>`,
      text: `${label}: ${before} -> ${after}`,
    };
  });
  return {
    subject: `Changes to ${metadata.eventName}`,
    html: `<div style="${EMAIL_BODY_STYLE}"><h1 style="font-size:24px">Something changed</h1><p>${escapeHtml(metadata.eventName)} has changed. Review the updated details below.</p><ul>${rows.map(({ html }) => html).join("")}</ul></div>`,
    text: `${metadata.eventName} has changed.\n\n${rows.map(({ text }) => text).join("\n")}`,
  };
}

export async function sendEventNotification(deliveryId: string) {
  const [delivery] = await db
    .select({
      id: emailDelivery.id,
      recipient: emailDelivery.recipient,
      outcome: emailDelivery.outcome,
      attemptCount: emailDelivery.attemptCount,
      metadata: emailDelivery.metadata,
    })
    .from(emailDelivery)
    .where(eq(emailDelivery.id, deliveryId))
    .limit(1);
  if (!delivery) throw new Error("Email Delivery not found.");
  if (delivery.outcome === "permanent_failure") {
    return { outcome: "suppressed" as const };
  }
  if (["submitted", "sent", "delivered"].includes(delivery.outcome)) {
    return { outcome: "already_submitted" as const };
  }

  const metadata = notificationSchema.parse(delivery.metadata);
  const message = content(metadata);
  try {
    await sendEmail({
      delivery: {
        kind: "existing",
        id: delivery.id,
        attemptCount: delivery.attemptCount,
      },
      message: { to: delivery.recipient, ...message },
      failureMessage: "The Event notification could not be sent.",
    });
    return { outcome: "submitted" as const };
  } catch (error) {
    if (!(error instanceof EmailDeliveryError)) throw error;
    return {
      outcome: error.retryable
        ? ("transient_failure" as const)
        : ("permanent_failure" as const),
    };
  }
}
