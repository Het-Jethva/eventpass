import "server-only";

import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { Resend } from "resend";

import { formatTicketCode } from "@/features/tickets/ticket-code";
import { db } from "@/lib/db";
import { emailDelivery } from "@/lib/db/schema";

const TEMPLATE = "ticket-issued-v1";

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ] ?? character,
  );
}

function formatEventRange(startsAt: Date, endsAt: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone,
    timeZoneName: "short",
  }).formatRange(startsAt, endsAt);
}

export async function sendTicket({
  email,
  attendeeName,
  event,
  ticketCode,
  ticketJws,
  managementToken,
}: {
  email: string;
  attendeeName: string;
  event: {
    name: string;
    eventTimeZone: string;
    startsAt: Date;
    endsAt: Date;
    venueName: string;
    venueAddress: string;
  };
  ticketCode: string;
  ticketJws: string;
  managementToken: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const applicationUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL;
  if (!apiKey) throw new Error("RESEND_API_KEY is required to send Ticket emails.");
  if (!applicationUrl) throw new Error("NEXT_PUBLIC_APP_URL is required to create Ticket links.");

  const managementUrl = new URL(`/tickets/${encodeURIComponent(managementToken)}`, applicationUrl);
  const formattedCode = formatTicketCode(ticketCode);
  const schedule = formatEventRange(event.startsAt, event.endsAt, event.eventTimeZone);
  const qrImage = await QRCode.toBuffer(ticketJws, {
    errorCorrectionLevel: "M",
    margin: 2,
    type: "png",
    width: 480,
  });
  const [delivery] = await db
    .insert(emailDelivery)
    .values({ template: TEMPLATE, recipient: email, provider: "resend", outcome: "pending" })
    .returning({ id: emailDelivery.id });
  if (!delivery) throw new Error("Could not create the Email Delivery record.");

  const resend = new Resend(apiKey);
  let response;
  try {
    response = await resend.emails.send(
      {
        from: process.env.RESEND_FROM_EMAIL ?? "EventPass <tickets@mail.hetjethva.tech>",
        to: email,
        subject: `Your Ticket for ${event.name}`,
        attachments: [
          {
            content: qrImage,
            contentId: "eventpass-ticket-qr",
            contentType: "image/png",
            filename: "eventpass-ticket.png",
          },
        ],
        html: `<div style="font-family:Arial,sans-serif;color:#171717;line-height:1.6;max-width:640px"><h1 style="font-size:24px">Your Ticket for ${escapeHtml(event.name)}</h1><p>${escapeHtml(attendeeName)}, your Registration is confirmed.</p><p><strong>When:</strong> ${escapeHtml(schedule)}<br><strong>Venue:</strong> ${escapeHtml(event.venueName)}, ${escapeHtml(event.venueAddress)}</p><p><img src="cid:eventpass-ticket-qr" width="280" height="280" alt="QR representation of your Ticket"></p><p><strong>Ticket Code:</strong> <span style="font-family:monospace;font-size:20px;letter-spacing:2px">${formattedCode}</span></p><p><a href="${escapeHtml(managementUrl.toString())}">Open your mobile and printable Ticket</a></p><p>This link manages your Registration. Do not forward it. You may show either the QR representation or Ticket Code at check-in.</p></div>`,
        text: `Your Registration for ${event.name} is confirmed.\n\nWhen: ${schedule}\nVenue: ${event.venueName}, ${event.venueAddress}\nTicket Code: ${formattedCode}\n\nOpen your mobile and printable Ticket: ${managementUrl.toString()}\n\nThis link manages your Registration. Do not forward it.`,
      },
      { idempotencyKey: `email-delivery/${delivery.id}` },
    );
  } catch {
    await db
      .update(emailDelivery)
      .set({ attemptCount: 1, failureKind: "transient", outcome: "transient_failure" })
      .where(eq(emailDelivery.id, delivery.id));
    throw new Error("The Ticket email could not be sent.");
  }

  if (!response.error) {
    await db
      .update(emailDelivery)
      .set({ attemptCount: 1, outcome: "submitted", providerMessageId: response.data.id })
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
  throw new Error("The Ticket email could not be sent.");
}
