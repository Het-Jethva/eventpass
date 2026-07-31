import QRCode from "qrcode";

import { ScanOutcome } from "@/features/admission/scan-outcome";
import { formatTicketCode } from "@/features/tickets/ticket-code";
import { TicketStub } from "@/features/tickets/ticket-stub";

// These are the real components from the product, rendered with static props —
// not screenshots. They stay theme-aware, stay responsive, cannot drift out of
// date as the components change, and cost no image bytes on an offline-first
// PWA.
//
// They are labelled as sample data. This product's entire pitch is that it does
// not overstate what it knows, and README.md makes a point of there being no
// seeded data; an unlabelled scan result for a person who does not exist would
// be a small crack in exactly that.

const SAMPLE = {
  attendeeName: "Priya Raman",
  ticketCode: "7QM4X-K3B9T",
  eventName: "Robotics Society Winter Showcase",
  schedule: "Fri, Dec 5, 6:30 – 9:30 PM",
  venue: "Whitcombe Hall, Building C",
};

export async function ScanOutcomeShowcase() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="overflow-hidden rounded-lg border">
        <div className="flex items-center justify-between gap-3 border-b bg-background px-4 py-3">
          <p className="text-sm font-medium">Online authority</p>
          <span className="text-xs text-muted-foreground">Final immediately</span>
        </div>
        <ScanOutcome
          outcome="accepted"
          attendeeName={SAMPLE.attendeeName}
          className="min-h-96"
        />
      </div>
      <div className="overflow-hidden rounded-lg border">
        <div className="flex items-center justify-between gap-3 border-b bg-background px-4 py-3">
          <p className="text-sm font-medium">Offline continuity</p>
          <span className="text-xs text-muted-foreground">
            Final after sync
          </span>
        </div>
        <ScanOutcome
          outcome="provisional"
          attendeeName={SAMPLE.attendeeName}
          className="min-h-96"
        />
      </div>
    </div>
  );
}

export async function TicketShowcase() {
  const qrDataUrl = await QRCode.toDataURL(
    `eventpass:sample:${SAMPLE.ticketCode}`,
    { errorCorrectionLevel: "M", margin: 2, width: 480 },
  );

  return (
    <TicketStub
      eventName={SAMPLE.eventName}
      attendeeName={SAMPLE.attendeeName}
      scheduleLabel={SAMPLE.schedule}
      venueName={SAMPLE.venue}
      status={{ label: "Registration confirmed", variant: "success" }}
      qrDataUrl={qrDataUrl}
      formattedCode={formatTicketCode(SAMPLE.ticketCode.replace("-", ""))}
      ticketCodeLabel={SAMPLE.ticketCode.replace("-", "")}
    />
  );
}

export function ShowcaseCaption() {
  return (
    <p className="text-sm text-muted-foreground">
      Real EventPass components, rendered here with sample data — not
      screenshots.
    </p>
  );
}
