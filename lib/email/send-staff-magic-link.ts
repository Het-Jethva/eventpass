import "server-only";

import { Resend } from "resend";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { emailDelivery } from "@/lib/db/schema";
import { EMAIL_BODY_STYLE } from "./shell";
import { escapeHtml } from "./escape-html";

const TEMPLATE = "staff-magic-link-v1";

export class StaffMagicLinkDeliveryError extends Error {
  constructor(public readonly retryable: boolean) {
    super("Resend could not accept the staff magic-link delivery.");
    this.name = "StaffMagicLinkDeliveryError";
  }
}

export async function sendStaffMagicLink(email: string, url: string) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is required to send staff magic links.");
  }

  const safeUrl = escapeHtml(url);
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

  if (!delivery) {
    throw new Error("Could not create the Email Delivery record.");
  }

  let response;

  try {
    response = await resend.emails.send(
      {
        from:
          process.env.RESEND_FROM_EMAIL ??
          "EventPass <sign-in@mail.hetjethva.tech>",
        to: email,
        subject: "Your EventPass sign-in link",
        html: `<div style="${EMAIL_BODY_STYLE}"><p>Use the secure link below to sign in to EventPass.</p><p><a href="${safeUrl}">Sign in to EventPass</a></p><p>This link expires in 15 minutes and can only be used once. If you did not request it, you can ignore this email.</p></div>`,
        text: `Sign in to EventPass: ${url}\n\nThis link expires in 15 minutes and can only be used once. If you did not request it, you can ignore this email.`,
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
    throw new StaffMagicLinkDeliveryError(true);
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
  throw new StaffMagicLinkDeliveryError(transient);
}
