import "server-only";

import { eq } from "drizzle-orm";
import { Resend } from "resend";

import { db } from "@/lib/db";
import { emailDelivery } from "@/lib/db/schema";
import { EMAIL_BODY_STYLE } from "./shell";

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ] ?? character,
  );
}

/**
 * Deadlines are communicated in the Event Time Zone, never the server's or
 * UTC: an Attendee reads "claim by 6:00 PM" against the clock on their wall.
 */
export function formatAdmissionOfferDeadline(expiresAt: Date, eventTimeZone: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: eventTimeZone,
    timeZoneName: "short",
  }).format(expiresAt);
}

export async function sendAdmissionOffer({
  email,
  attendeeName,
  eventId,
  eventName,
  eventTimeZone,
  expiresAt,
  token,
}: {
  email: string;
  attendeeName: string;
  eventId: string;
  eventName: string;
  eventSlug: string;
  eventTimeZone: string;
  expiresAt: Date;
  token: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const applicationUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL;
  if (!apiKey) throw new Error("RESEND_API_KEY is required to send Admission Offers.");
  if (!applicationUrl) throw new Error("NEXT_PUBLIC_APP_URL is required to create offer links.");
  const claimUrl = new URL(`/offers/${encodeURIComponent(token)}`, applicationUrl);
  const deadline = formatAdmissionOfferDeadline(expiresAt, eventTimeZone);
  const [delivery] = await db
    .insert(emailDelivery)
    .values({
      template: "admission-offer-v1",
      recipient: email,
      provider: "resend",
      eventId,
      outcome: "pending",
    })
    .returning({ id: emailDelivery.id });
  if (!delivery) throw new Error("Could not create the Email Delivery record.");

  const resend = new Resend(apiKey);
  let response;
  try {
    response = await resend.emails.send(
      {
        from: process.env.RESEND_FROM_EMAIL ?? "EventPass <tickets@mail.hetjethva.tech>",
        to: email,
        subject: `A place is available for ${eventName}`,
        html: `<div style="${EMAIL_BODY_STYLE}"><h1 style="font-size:24px">A place is available</h1><p>${escapeHtml(attendeeName)}, you reached the front of the waitlist for ${escapeHtml(eventName)}.</p><p><a href="${escapeHtml(claimUrl.toString())}">Review and claim your place</a> by ${escapeHtml(deadline)}. The offer expires automatically and cannot be restored.</p><p>Keep this claim link to yourself.</p></div>`,
        text: `${attendeeName}, you reached the front of the waitlist for ${eventName}.\n\nClaim your place by ${deadline}: ${claimUrl.toString()}\n\nKeep this claim link to yourself.`,
      },
      { idempotencyKey: `email-delivery/${delivery.id}` },
    );
  } catch {
    await db
      .update(emailDelivery)
      .set({ attemptCount: 1, failureKind: "transient", outcome: "transient_failure" })
      .where(eq(emailDelivery.id, delivery.id));
    throw new Error("The Admission Offer email could not be sent.");
  }
  if (!response.error) {
    await db
      .update(emailDelivery)
      .set({ attemptCount: 1, outcome: "submitted", providerMessageId: response.data.id })
      .where(eq(emailDelivery.id, delivery.id));
    return;
  }
  const transient =
    response.error.statusCode === 429 ||
    (response.error.statusCode !== null && response.error.statusCode >= 500);
  await db
    .update(emailDelivery)
    .set({
      attemptCount: 1,
      failureKind: transient ? "transient" : "permanent",
      outcome: transient ? "transient_failure" : "permanent_failure",
    })
    .where(eq(emailDelivery.id, delivery.id));
  throw new Error("The Admission Offer email could not be sent.");
}
