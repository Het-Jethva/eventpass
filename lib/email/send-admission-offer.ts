import "server-only";

import { eq } from "drizzle-orm";
import { Resend } from "resend";

import { db } from "@/lib/db";
import { emailDelivery } from "@/lib/db/schema";

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ] ?? character,
  );
}

export async function sendAdmissionOffer({
  email,
  attendeeName,
  eventName,
  expiresAt,
  token,
}: {
  email: string;
  attendeeName: string;
  eventName: string;
  eventSlug: string;
  expiresAt: Date;
  token: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const applicationUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL;
  if (!apiKey) throw new Error("RESEND_API_KEY is required to send Admission Offers.");
  if (!applicationUrl) throw new Error("NEXT_PUBLIC_APP_URL is required to create offer links.");
  const claimUrl = new URL(`/offers/${encodeURIComponent(token)}`, applicationUrl);
  const deadline = new Intl.DateTimeFormat("en", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(expiresAt);
  const [delivery] = await db
    .insert(emailDelivery)
    .values({
      template: "admission-offer-v1",
      recipient: email,
      provider: "resend",
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
        html: `<div style="font-family:Arial,sans-serif;color:#171717;line-height:1.6;max-width:640px"><h1 style="font-size:24px">A place is available</h1><p>${escapeHtml(attendeeName)}, you reached the front of the waitlist for ${escapeHtml(eventName)}.</p><p><a href="${escapeHtml(claimUrl.toString())}">Review and claim your place</a> by ${escapeHtml(deadline)}. The offer expires automatically and cannot be restored.</p><p>Do not forward this private claim link.</p></div>`,
        text: `${attendeeName}, you reached the front of the waitlist for ${eventName}.\n\nClaim your place by ${deadline}: ${claimUrl.toString()}\n\nDo not forward this private claim link.`,
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
