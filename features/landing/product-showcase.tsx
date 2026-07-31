import QRCode from "qrcode";

import { ScanOutcome } from "@/features/admission/scan-outcome";
import { formatTicketCode } from "@/features/tickets/ticket-code";
import { TicketStub } from "@/features/tickets/ticket-stub";

// These are the product's own components rendered with example props — not
// screenshots. They stay theme-aware, stay responsive, cannot drift out of date
// as the components change, and cost no image bytes on a page that has to load
// on venue Wi-Fi.
//
// The event and the guest are invented, and each surface says so where it is
// read. Relying on the hero frame's caption to cover the whole page meant a
// visitor met a scannable code, a named guest and a dated venue two viewports
// later with nothing marking them as an example.

const SAMPLE = {
  attendeeName: "Priya Raman",
  ticketCode: "7QM4X-K3B9T",
  eventName: "Robotics Society Winter Showcase",
  schedule: "Fri, Dec 5, 6:30 – 9:30 PM",
  venue: "Whitcombe Hall, Building C",
};

export async function ScanOutcomeShowcase() {
  return (
    <figure className="flex flex-col gap-3">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="overflow-hidden rounded-xl border">
          <div className="flex items-center justify-between gap-3 border-b bg-background px-4 py-3">
            <p className="text-sm font-medium">With a signal</p>
            <span className="text-sm text-muted-foreground">
              Settled at once
            </span>
          </div>
          <ScanOutcome
            outcome="accepted"
            attendeeName={SAMPLE.attendeeName}
            titleAs="p"
            className="min-h-96"
          />
        </div>
        <div className="overflow-hidden rounded-xl border">
          <div className="flex items-center justify-between gap-3 border-b bg-background px-4 py-3">
            <p className="text-sm font-medium">Without a signal</p>
            <span className="text-sm text-muted-foreground">
              Settles when you reconnect
            </span>
          </div>
          <ScanOutcome
            outcome="provisional"
            attendeeName={SAMPLE.attendeeName}
            titleAs="p"
            className="min-h-96"
          />
        </div>
      </div>
      <figcaption className="text-xs text-muted-foreground">
        Example guest.
      </figcaption>
    </figure>
  );
}

export async function TicketShowcase() {
  const qrDataUrl = await QRCode.toDataURL(
    `eventpass:sample:${SAMPLE.ticketCode}`,
    { errorCorrectionLevel: "M", margin: 2, width: 480 },
  );

  return (
    <figure className="flex flex-col gap-3">
      <TicketStub
        eventName={SAMPLE.eventName}
        attendeeName={SAMPLE.attendeeName}
        scheduleLabel={SAMPLE.schedule}
        venueName={SAMPLE.venue}
        status={{ label: "Registered", variant: "success" }}
        qrDataUrl={qrDataUrl}
        formattedCode={formatTicketCode(SAMPLE.ticketCode.replace("-", ""))}
        ticketCodeLabel={SAMPLE.ticketCode.replace("-", "")}
        surroundClassName="bg-muted"
        titleAs="h3"
      />
      <figcaption className="text-xs text-muted-foreground">
        Example ticket. The code shown is not valid for any event.
      </figcaption>
    </figure>
  );
}
