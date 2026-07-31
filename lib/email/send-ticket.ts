import "server-only";

import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { Resend } from "resend";

import { formatTicketCode } from "@/features/tickets/ticket-code";
import { db } from "@/lib/db";
import { emailDelivery } from "@/lib/db/schema";
import { EMAIL_BODY_STYLE, EMAIL_CODE_STYLE } from "./shell";

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
  eventId,
  event,
  ticketCode,
  ticketJws,
  managementToken,
}: {
  email: string;
  attendeeName: string;
  eventId: string;
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
    .values({
      template: TEMPLATE,
      recipient: email,
      provider: "resend",
      eventId,
      outcome: "pending",
    })
    .returning({ id: emailDelivery.id });
  if (!delivery) throw new Error("Could not create the Email Delivery record.");

  const resend = new Resend(apiKey);
  let response;
  try {
    response = await resend.emails.send(
      {
        from: process.env.RESEND_FROM_EMAIL ?? "EventPass <tickets@mail.hetjethva.tech>",
        to: email,
        subject: `Your ticket for ${event.name}`,
        attachments: [
          {
            content: qrImage,
            contentId: "eventpass-ticket-qr",
            contentType: "image/png",
            filename: "eventpass-ticket.png",
          },
        ],
        html: `<div style="${EMAIL_BODY_STYLE}"><h1 style="font-size:24px">Your ticket for ${escapeHtml(event.name)}</h1><p>${escapeHtml(attendeeName)}, you’re registered.</p><p><strong>When:</strong> ${escapeHtml(schedule)}<br><strong>Venue:</strong> ${escapeHtml(event.venueName)}, ${escapeHtml(event.venueAddress)}</p><p><img src="cid:eventpass-ticket-qr" width="280" height="280" alt="QR code for your ticket"></p><p><strong>Ticket code:</strong> <span style="${EMAIL_CODE_STYLE}">${formattedCode}</span></p><p><a href="${escapeHtml(managementUrl.toString())}">Open your ticket</a></p><p>This link manages your registration, so keep it to yourself. At the door, show either the QR code or the ticket code.</p></div>`,
        text: `You’re registered for ${event.name}.\n\nWhen: ${schedule}\nVenue: ${event.venueName}, ${event.venueAddress}\nTicket code: ${formattedCode}\n\nOpen your ticket: ${managementUrl.toString()}\n\nThis link manages your registration, so keep it to yourself.`,
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
