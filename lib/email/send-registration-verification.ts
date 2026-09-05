import "server-only";

import { Resend } from "resend";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { emailDelivery } from "@/lib/db/schema";
import { EMAIL_BODY_STYLE } from "./shell";

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
  eventId,
  eventName,
  eventSlug,
  token,
}: {
  registrationId: string;
  email: string;
  eventId: string;
  eventName: string;
  eventSlug: string;
  token: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const applicationUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL;
  if (!apiKey) throw new Error("RESEND_API_KEY is required to send verification emails.");
  if (!applicationUrl) throw new Error("NEXT_PUBLIC_APP_URL is required to create verification links.");

  const resend = new Resend(apiKey);
  const [delivery] = await db
    .insert(emailDelivery)
    .values({
      template: TEMPLATE,
      recipient: email,
      provider: "resend",
      eventId,
      outcome: "pending",
    })
    .returning({ id: emailDelivery.id });
  if (!delivery) throw new Error("Could not create the Email Delivery record.");

  const sendAttempt = async (attemptToken: string, attempt: number) => {
    const verificationUrl = new URL(
      `/e/${encodeURIComponent(eventSlug)}/verify`,
      applicationUrl,
    );
    verificationUrl.searchParams.set("token", attemptToken);
    try {
      const response = await resend.emails.send(
        {
          from:
            process.env.RESEND_FROM_EMAIL ??
            "EventPass <registration@mail.hetjethva.tech>",
          to: email,
          subject: `Confirm your place at ${eventName}`,
          html: `<div style="${EMAIL_BODY_STYLE}"><p>Confirm your email address to finish registering for <strong>${escapeHtml(eventName)}</strong>.</p><p><a href="${escapeHtml(verificationUrl.toString())}">Confirm my email</a></p><p>Open the link and confirm. This expires in 15 minutes. If you did not register, you can ignore this email.</p></div>`,
          text: `Confirm your place at ${eventName}: ${verificationUrl.toString()}\n\nOpen the link and confirm. This expires in 15 minutes.`,
        },
        { idempotencyKey: `email-delivery/${delivery.id}/attempt/${attempt}` },
      );
      if (!response.error) {
        return { kind: "submitted" as const, id: response.data.id };
      }
      const transient =
        response.error.statusCode === 429 ||
        (response.error.statusCode !== null && response.error.statusCode >= 500);
      return { kind: transient ? ("transient" as const) : ("permanent" as const) };
    } catch {
      return { kind: "transient" as const };
    }
  };

  const recordFailure = async (
    attemptCount: number,
    kind: "transient" | "permanent",
  ) => {
    await db
      .update(emailDelivery)
      .set({
        attemptCount,
        failureKind: kind,
        outcome:
          kind === "transient" ? "transient_failure" : "permanent_failure",
      })
      .where(eq(emailDelivery.id, delivery.id));
  };

  const firstAttempt = await sendAttempt(token, 1);
  if (firstAttempt.kind === "submitted") {
    await db
      .update(emailDelivery)
      .set({
        attemptCount: 1,
        outcome: "submitted",
        providerMessageId: firstAttempt.id,
      })
      .where(eq(emailDelivery.id, delivery.id));
    return;
  }
  await recordFailure(1, firstAttempt.kind);
  if (firstAttempt.kind === "permanent") {
    throw new Error("The verification email could not be sent.");
  }

  const retry = await sendAttempt(token, 2);
  if (retry.kind === "submitted") {
    await db
      .update(emailDelivery)
      .set({
        attemptCount: 2,
        failureKind: null,
        outcome: "submitted",
        providerMessageId: retry.id,
      })
      .where(eq(emailDelivery.id, delivery.id));
    return;
  }
  await recordFailure(2, retry.kind);
  throw new Error("The verification email could not be sent.");
}
