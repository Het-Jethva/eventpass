import "server-only";

import { Resend } from "resend";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { emailDelivery } from "@/lib/db/schema";

const TEMPLATE = "registration-verification-v1";

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character,
  );
}

export async function sendRegistrationVerification({
  email,
  eventName,
  eventSlug,
  token,
}: {
  email: string;
  eventName: string;
  eventSlug: string;
  token: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const applicationUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL;
  if (!apiKey) throw new Error("RESEND_API_KEY is required to send verification emails.");
  if (!applicationUrl) throw new Error("NEXT_PUBLIC_APP_URL is required to create verification links.");

  const verificationUrl = new URL(`/e/${encodeURIComponent(eventSlug)}/verify`, applicationUrl);
  verificationUrl.searchParams.set("token", token);
  const resend = new Resend(apiKey);
  const [delivery] = await db
    .insert(emailDelivery)
    .values({
      template: TEMPLATE,
      recipient: email,
      provider: "resend",
      outcome: "pending",
    })
    .returning({ id: emailDelivery.id });
  if (!delivery) throw new Error("Could not create the Email Delivery record.");

  let response;
  try {
    response = await resend.emails.send(
      {
        from:
          process.env.RESEND_FROM_EMAIL ??
          "EventPass <registration@mail.hetjethva.tech>",
        to: email,
        subject: `Verify your Registration for ${eventName}`,
        html: `<div style="font-family:Arial,sans-serif;color:#171717;line-height:1.6"><p>Verify your email address to continue your Registration for <strong>${escapeHtml(eventName)}</strong>.</p><p><a href="${escapeHtml(verificationUrl.toString())}">Verify Registration</a></p><p>This single-use link expires in 15 minutes. If you did not submit this Registration, you can ignore this email.</p></div>`,
        text: `Verify your Registration for ${eventName}: ${verificationUrl.toString()}\n\nThis single-use link expires in 15 minutes.`,
      },
      { idempotencyKey: `email-delivery/${delivery.id}` },
    );
  } catch {
    await db
      .update(emailDelivery)
      .set({
        attemptCount: 1,
        failureKind: "transient",
        outcome: "transient_failure",
      })
      .where(eq(emailDelivery.id, delivery.id));
    throw new Error("The verification email could not be sent.");
  }

  if (!response.error) {
    await db
      .update(emailDelivery)
      .set({
        attemptCount: 1,
        outcome: "submitted",
        providerMessageId: response.data.id,
      })
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
  throw new Error("The verification email could not be sent.");
}
