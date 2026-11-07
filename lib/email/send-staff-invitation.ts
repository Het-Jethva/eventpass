import "server-only";

import type { InviteableStaffRole } from "@/features/staffing/staffing-policy";
import { EMAIL_BODY_STYLE } from "./shell";
import { escapeHtml } from "./escape-html";
import { sendEmail } from "./send-email";

export async function sendStaffInvitationEmail(input: {
  email: string;
  eventId: string;
  eventName: string;
  invitationUrl: string;
  role: InviteableStaffRole;
}) {
  const roleLabel =
    input.role === "organizer" ? "Organizer" : "Check-in Volunteer";
  await sendEmail({
    delivery: {
      kind: "new",
      template: "staff-invitation-v1",
      eventId: input.eventId,
    },
    failureMessage:
      "The Staff Invitation was saved, but its email was not accepted.",
    message: {
      to: input.email,
      subject: `Join ${input.eventName} on EventPass`,
      html: `<div style="${EMAIL_BODY_STYLE}"><p>You have been invited to help with <strong>${escapeHtml(input.eventName)}</strong> as ${roleLabel}.</p><p><a href="${escapeHtml(input.invitationUrl)}">Review the invitation</a></p><p>The invitation is tied to this email address, works once, and expires in 24 hours.</p></div>`,
      text: `You have been invited to help with ${input.eventName} as ${roleLabel}.\n\nReview the invitation: ${input.invitationUrl}\n\nThe invitation is tied to this email address, works once, and expires in 24 hours.`,
    },
  });
}
