import "server-only";

import { sendEmail } from "./send-email";

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
}) {
  await sendEmail({
    delivery: { kind: "new", template: "waitlist-confirmed-v1", eventId },
    failureMessage: "The waitlist confirmation could not be sent.",
    message: {
      to: email,
      subject: `You joined the waitlist for ${eventName}`,
      text: `${attendeeName}, your email is confirmed and your place on the waitlist for ${eventName} is held. If a place opens up, we’ll email you an offer with a deadline.`,
    },
  });
}
