import "server-only";

import QRCode from "qrcode";

import { TICKET_ISSUED_TEMPLATE } from "@/features/messaging/email-delivery-state";
import { formatTicketCode } from "@/features/tickets/ticket-code";
import { getConfiguredApplicationUrl } from "@/lib/application-url";
import { formatEventRange } from "@/lib/format-event-range";
import { EMAIL_BODY_STYLE, EMAIL_CODE_STYLE } from "./shell";
import { escapeHtml } from "./escape-html";
import { sendEmail } from "./send-email";

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
  const managementUrl = new URL(
    `/tickets/${encodeURIComponent(managementToken)}`,
    getConfiguredApplicationUrl(),
  );
  const formattedCode = formatTicketCode(ticketCode);
  const schedule = formatEventRange(
    event.startsAt,
    event.endsAt,
    event.eventTimeZone,
  );
  const qrImage = await QRCode.toBuffer(ticketJws, {
    errorCorrectionLevel: "M",
    margin: 2,
    type: "png",
    width: 480,
  });

  await sendEmail({
    delivery: { kind: "new", template: TICKET_ISSUED_TEMPLATE, eventId },
    failureMessage: "The Ticket email could not be sent.",
    message: {
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
  });
}
