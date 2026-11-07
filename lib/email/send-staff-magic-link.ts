import "server-only";

import { EMAIL_BODY_STYLE } from "./shell";
import { escapeHtml } from "./escape-html";
import { sendEmail } from "./send-email";

export async function sendStaffMagicLink(email: string, url: string) {
  await sendEmail({
    delivery: { kind: "new", template: "staff-magic-link-v1" },
    maxAttempts: 3,
    failureMessage: "The staff magic-link email could not be sent.",
    message: {
      to: email,
      subject: "Your EventPass sign-in link",
      html: `<div style="${EMAIL_BODY_STYLE}"><p>Use the secure link below to sign in to EventPass.</p><p><a href="${escapeHtml(url)}">Sign in to EventPass</a></p><p>This link expires in 15 minutes and can only be used once. If you did not request it, you can ignore this email.</p></div>`,
      text: `Sign in to EventPass: ${url}\n\nThis link expires in 15 minutes and can only be used once. If you did not request it, you can ignore this email.`,
    },
  });
}
