import "server-only";

import { Resend } from "resend";
import { eq } from "drizzle-orm";

import type { InviteableStaffRole } from "@/features/staffing/staffing-policy";
import { db } from "@/lib/db";
import { emailDelivery } from "@/lib/db/schema";
import { EMAIL_BODY_STYLE } from "./shell";
import { escapeHtml } from "./escape-html";

const TEMPLATE = "staff-invitation-v1";

export async function sendStaffInvitationEmail(input: {
  email: string;
  eventId: string;
  eventName: string;
  invitationUrl: string;
  role: InviteableStaffRole;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is required to send Staff Invitations.");

  const [delivery] = await db
    .insert(emailDelivery)
    .values({
      template: TEMPLATE,
      recipient: input.email,
      provider: "resend",
      eventId: input.eventId,
      outcome: "pending",
    })
    .returning({ id: emailDelivery.id });
  if (!delivery) throw new Error("Could not create the Email Delivery record.");

  const roleLabel =
    input.role === "organizer" ? "Organizer" : "Check-in Volunteer";
  const resend = new Resend(apiKey);
  let response;
  try {
    response = await resend.emails.send(
      {
        from:
          process.env.RESEND_FROM_EMAIL ??
          "EventPass <staff@mail.hetjethva.tech>",
        to: input.email,
        subject: `Join ${input.eventName} on EventPass`,
        html: `<div style="${EMAIL_BODY_STYLE}"><p>You have been invited to help with <strong>${escapeHtml(input.eventName)}</strong> as ${roleLabel}.</p><p><a href="${escapeHtml(input.invitationUrl)}">Review the invitation</a></p><p>The invitation is tied to this email address, works once, and expires in 24 hours.</p></div>`,
        text: `You have been invited to help with ${input.eventName} as ${roleLabel}.\n\nReview the invitation: ${input.invitationUrl}\n\nThe invitation is tied to this email address, works once, and expires in 24 hours.`,
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
    throw new Error("The Staff Invitation was saved, but its email was not accepted.");
  }

  if (response.error) {
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
    throw new Error("The Staff Invitation was saved, but its email was not accepted.");
  }

  await db
    .update(emailDelivery)
    .set({
      attemptCount: 1,
      outcome: "submitted",
      providerMessageId: response.data.id,
    })
    .where(eq(emailDelivery.id, delivery.id));
}
