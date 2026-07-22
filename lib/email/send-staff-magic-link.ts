import "server-only";

import { Resend } from "resend";

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

export async function sendStaffMagicLink(email: string, url: string) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is required to send staff magic links.");
  }

  const safeUrl = escapeHtml(url);
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from:
      process.env.RESEND_FROM_EMAIL ??
      "EventPass <sign-in@mail.hetjethva.tech>",
    to: email,
    subject: "Your EventPass sign-in link",
    html: `<div style="font-family:Arial,sans-serif;color:#171717;line-height:1.6"><p>Use the secure link below to sign in to EventPass.</p><p><a href="${safeUrl}">Sign in to EventPass</a></p><p>This link expires in 15 minutes and can only be used once. If you did not request it, you can ignore this email.</p></div>`,
    text: `Sign in to EventPass: ${url}\n\nThis link expires in 15 minutes and can only be used once. If you did not request it, you can ignore this email.`,
  });

  if (error) {
    throw new Error(`Resend could not send the staff magic link: ${error.message}`);
  }
}
