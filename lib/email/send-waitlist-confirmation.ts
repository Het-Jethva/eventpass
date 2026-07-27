import "server-only";

import { eq } from "drizzle-orm";
import { Resend } from "resend";

import { db } from "@/lib/db";
import { emailDelivery } from "@/lib/db/schema";

export async function sendWaitlistConfirmation({
  email,
  attendeeName,
  eventId,
  eventName,
}: {
  email: string;
  attendeeName: string;
  eventId: string;
  eventName: string;
  eventSlug: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is required to send waitlist emails.");
  const [delivery] = await db
    .insert(emailDelivery)
    .values({
      template: "waitlist-confirmed-v1",
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
        subject: `You joined the waitlist for ${eventName}`,
        text: `${attendeeName}, your email is verified and your place on the waitlist for ${eventName} is now established. If capacity becomes available, EventPass will email you a time-limited Admission Offer.`,
      },
      { idempotencyKey: `email-delivery/${delivery.id}` },
    );
  } catch {
    await db
      .update(emailDelivery)
      .set({ attemptCount: 1, failureKind: "transient", outcome: "transient_failure" })
      .where(eq(emailDelivery.id, delivery.id));
    throw new Error("The waitlist confirmation could not be sent.");
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
  throw new Error("The waitlist confirmation could not be sent.");
}
