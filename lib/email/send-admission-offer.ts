import "server-only";

import { getConfiguredApplicationUrl } from "@/lib/application-url";
import { formatEventInstant } from "@/lib/format-event-range";
import { EMAIL_BODY_STYLE } from "./shell";
import { escapeHtml } from "./escape-html";
import { sendEmail } from "./send-email";

export function formatAdmissionOfferDeadline(
  expiresAt: Date,
  eventTimeZone: string,
) {
  return formatEventInstant(expiresAt, eventTimeZone);
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
  eventTimeZone: string;
  expiresAt: Date;
  token: string;
}) {
  const claimUrl = new URL(
    `/offers/${encodeURIComponent(token)}`,
    getConfiguredApplicationUrl(),
  );
  const deadline = formatAdmissionOfferDeadline(expiresAt, eventTimeZone);

  await sendEmail({
    delivery: { kind: "new", template: "admission-offer-v1", eventId },
    maxAttempts: 2,
    failureMessage: "The Admission Offer email could not be sent.",
    message: {
      to: email,
      subject: `A place is available for ${eventName}`,
      html: `<div style="${EMAIL_BODY_STYLE}"><h1 style="font-size:24px">A place is available</h1><p>${escapeHtml(attendeeName)}, you reached the front of the waitlist for ${escapeHtml(eventName)}.</p><p><a href="${escapeHtml(claimUrl.toString())}">Review and claim your place</a> by ${escapeHtml(deadline)}. The offer expires automatically and cannot be restored.</p><p>Keep this claim link to yourself.</p></div>`,
      text: `${attendeeName}, you reached the front of the waitlist for ${eventName}.\n\nClaim your place by ${deadline}: ${claimUrl.toString()}\n\nKeep this claim link to yourself.`,
    },
  });
}
