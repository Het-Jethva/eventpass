import "server-only";

import { getConfiguredApplicationUrl } from "@/lib/application-url";
import { EMAIL_BODY_STYLE } from "./shell";
import { escapeHtml } from "./escape-html";
import { sendEmail } from "./send-email";

export async function sendRegistrationVerification({
  email,
  eventId,
  eventName,
  eventSlug,
  token,
}: {
  email: string;
  eventId: string;
  eventName: string;
  eventSlug: string;
  token: string;
}) {
  const verificationUrl = new URL(
    `/e/${encodeURIComponent(eventSlug)}/verify`,
    getConfiguredApplicationUrl(),
  );
  verificationUrl.searchParams.set("token", token);

  await sendEmail({
    delivery: {
      kind: "new",
      template: "registration-verification-v1",
      eventId,
    },
    maxAttempts: 2,
    failureMessage: "The verification email could not be sent.",
    message: {
      to: email,
      subject: `Confirm your place at ${eventName}`,
      html: `<div style="${EMAIL_BODY_STYLE}"><p>Confirm your email address to finish registering for <strong>${escapeHtml(eventName)}</strong>.</p><p><a href="${escapeHtml(verificationUrl.toString())}">Confirm my email</a></p><p>Open the link and confirm. This expires in 15 minutes. If you did not register, you can ignore this email.</p></div>`,
      text: `Confirm your place at ${eventName}: ${verificationUrl.toString()}\n\nOpen the link and confirm. This expires in 15 minutes.`,
    },
  });
}
