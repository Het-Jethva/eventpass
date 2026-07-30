import Image from "next/image";
import type { ReactNode } from "react";
import { IconCalendarEvent, IconMapPin, IconTicketOff } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// The Ticket is the one object this product asks someone to keep, and it is
// opened on a phone at a door in almost every real case. So the QR leads on
// every viewport — it previously sat below the event details and the full
// management form, meaning an attendee had to scroll past a cancellation
// control to reach the thing they came to show. DESIGN.md § Components.
//
// Kept as a component so the landing page can render a real Ticket rather than
// a screenshot.

function TicketPerforation({ surroundClassName }: { surroundClassName: string }) {
  return (
    <div
      aria-hidden="true"
      className="relative h-6 w-full shrink-0 sm:h-auto sm:w-6 sm:self-stretch"
    >
      {/* Notches sit half outside the card so the tear line reads as a physical
          cut rather than a divider. They have to carry the colour of whatever
          surrounds the Ticket, which differs by host — bg-muted on the ticket
          page, the plain page background in the landing showcase — so the
          caller supplies it rather than the component assuming. */}
      <span
        className={cn(
          "absolute left-0 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full sm:left-1/2 sm:top-0 print:hidden",
          surroundClassName,
        )}
      />
      <span
        className={cn(
          "absolute left-full top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full sm:left-1/2 sm:top-full print:hidden",
          surroundClassName,
        )}
      />
      {/* Two elements rather than `perforation-x sm:perforation-y`: both
          utilities would apply at sm, and which background-repeat won would
          depend on Tailwind's emit order rather than on the class list. */}
      <div className="perforation-x absolute inset-x-4 top-1/2 h-0.5 -translate-y-1/2 sm:hidden" />
      <div className="perforation-y absolute inset-y-4 left-1/2 hidden w-0.5 -translate-x-1/2 sm:block" />
    </div>
  );
}

export function TicketStub({
  eventName,
  attendeeName,
  scheduleLabel,
  venueName,
  status,
  qrDataUrl,
  formattedCode,
  ticketCodeLabel,
  action,
  className,
  surroundClassName = "bg-background",
}: {
  eventName: string;
  attendeeName: string;
  scheduleLabel: string;
  venueName: string;
  status: { label: string; variant: "success" | "warning" | "destructive" };
  /** Omit to render the inactive state, where no admissible Ticket exists. */
  qrDataUrl?: string | null;
  formattedCode?: string | null;
  /** Unformatted code, announced instead of the grouped display form. */
  ticketCodeLabel?: string | null;
  action?: ReactNode;
  className?: string;
  /** Background utility of whatever sits behind the Ticket, for the notches. */
  surroundClassName?: string;
}) {
  return (
    <article
      className={cn(
        "overflow-hidden rounded-lg border bg-background print:rounded-none print:border-2",
        className,
      )}
    >
      {/* Reversed on mobile so the stub renders first on a phone while the DOM
          keeps the Event name ahead of the QR for screen readers. */}
      <div className="flex flex-col-reverse sm:flex-row">
        <div className="flex flex-1 flex-col gap-4 p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={status.variant}>{status.label}</Badge>
            {action ? <div className="ml-auto print:hidden">{action}</div> : null}
          </div>

          <div className="flex flex-col gap-1">
            {/* One of the four places the display serif is permitted. */}
            <h1 className="font-heading text-3xl leading-tight text-balance sm:text-4xl">
              {eventName}
            </h1>
            <p className="text-base text-muted-foreground">
              Ticket for{" "}
              <span className="font-medium text-foreground">{attendeeName}</span>
            </p>
          </div>

          <dl className="mt-auto flex flex-col gap-2 text-sm">
            <div className="flex items-start gap-2">
              <dt className="shrink-0">
                <IconCalendarEvent aria-hidden="true" className="size-4 translate-y-0.5" />
                <span className="sr-only">Schedule</span>
              </dt>
              <dd className="text-muted-foreground">{scheduleLabel}</dd>
            </div>
            <div className="flex items-start gap-2">
              <dt className="shrink-0">
                <IconMapPin aria-hidden="true" className="size-4 translate-y-0.5" />
                <span className="sr-only">Venue</span>
              </dt>
              <dd className="text-muted-foreground">{venueName}</dd>
            </div>
          </dl>
        </div>

        <TicketPerforation surroundClassName={surroundClassName} />

        <div className="flex shrink-0 flex-col items-center gap-4 p-6 text-center sm:w-72 sm:p-8">
          {qrDataUrl && formattedCode ? (
            <>
              {/* Fixed white chamber in both themes. A theme-inverted QR does
                  not scan. */}
              <div className="rounded-md bg-white p-3">
                <Image
                  src={qrDataUrl}
                  alt={`QR representation of Ticket ${formattedCode}`}
                  width={320}
                  height={320}
                  unoptimized
                  priority
                  className="size-40 sm:size-48"
                />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Ticket Code
                </p>
                <p
                  className="font-mono text-2xl font-semibold tracking-[0.14em]"
                  aria-label={ticketCodeLabel ?? formattedCode}
                >
                  {formattedCode}
                </p>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                Single entry · Valid only for this Event
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-8">
              <IconTicketOff aria-hidden="true" className="size-10 text-muted-foreground" />
              <p className="text-sm font-medium">No admissible Ticket</p>
              <p className="max-w-xs text-xs leading-5 text-muted-foreground">
                The previous Ticket is retained in history and cannot be
                presented for admission.
              </p>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
