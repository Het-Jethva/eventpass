import "server-only";

import { eq, sql } from "drizzle-orm";
import { Resend } from "resend";
import { z } from "zod";

import { db } from "@/lib/db";
import { emailDelivery } from "@/lib/db/schema";
import { EMAIL_BODY_STYLE } from "./shell";

const materialChangeSchema = z.object({
  kind: z.literal("material_change"),
  eventId: z.string(),
  eventName: z.string(),
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

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ] ?? character,
  );
}

function display(value: string | number | null) {
  if (value === null || value === "") return "Not set";
  if (typeof value === "number") return value.toLocaleString("en");
  const date = /^\d{4}-\d{2}-\d{2}T/.test(value) ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat("en", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "UTC",
        timeZoneName: "short",
      }).format(date)
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

  const rows = metadata.changes.map((change) => {
    const label = FIELD_LABELS[change.field] ?? change.field;
    return {
      html: `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(display(change.before))} → ${escapeHtml(display(change.after))}</li>`,
      text: `${label}: ${display(change.before)} -> ${display(change.after)}`,
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
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is required to send Event notifications.");
  const attempt = delivery.attemptCount + 1;
  let response;
  try {
    response = await new Resend(apiKey).emails.send(
      {
        from:
          process.env.RESEND_FROM_EMAIL ??
          "EventPass <events@mail.hetjethva.tech>",
        to: delivery.recipient,
        ...message,
      },
      { idempotencyKey: `email-delivery/${delivery.id}/attempt/${attempt}` },
    );
  } catch {
    await db
      .update(emailDelivery)
      .set({
        attemptCount: sql`${emailDelivery.attemptCount} + 1`,
        failureKind: "transient",
        outcome: "transient_failure",
      })
      .where(eq(emailDelivery.id, delivery.id));
    return { outcome: "transient_failure" as const };
  }

  if (!response.error) {
    await db
      .update(emailDelivery)
      .set({
        attemptCount: sql`${emailDelivery.attemptCount} + 1`,
        failureKind: null,
        outcome: "submitted",
        providerMessageId: response.data.id,
      })
      .where(eq(emailDelivery.id, delivery.id));
    return { outcome: "submitted" as const };
  }

  const transient =
    response.error.statusCode === 429 ||
    (response.error.statusCode !== null && response.error.statusCode >= 500);
  await db
    .update(emailDelivery)
    .set({
      attemptCount: sql`${emailDelivery.attemptCount} + 1`,
      failureKind: transient ? "transient" : "permanent",
      outcome: transient ? "transient_failure" : "permanent_failure",
    })
    .where(eq(emailDelivery.id, delivery.id));
  return {
    outcome: transient ? ("transient_failure" as const) : ("permanent_failure" as const),
  };
}
