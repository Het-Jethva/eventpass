import Link from "next/link";
import {
  IconCalendarEvent,
  IconClock,
  IconExternalLink,
  IconMapPin,
  IconUsers,
} from "@tabler/icons-react";

import { EventPassMark } from "@/components/eventpass-mark";

export type PublicEventDetails = {
  name: string;
  description: string;
  eventTimeZone: string;
  startsAt: Date;
  endsAt: Date;
  venueName: string;
  venueAddress: string;
  venueMapUrl: string | null;
  capacity: number;
  registrationOpensAt: Date;
  registrationClosesAt: Date;
};

function formatRange(startsAt: Date, endsAt: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone,
  }).formatRange(startsAt, endsAt);
}

function formatMoment(moment: Date, timeZone: string) {
  // Components spelled out because `dateStyle`/`timeStyle` cannot be combined
  // with `timeZoneName`; the mix throws "Invalid option : option".
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(moment);
}

export function EventPublicDetails({
  event,
  registration,
}: {
  event: PublicEventDetails;
  registration?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col bg-muted/20">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center px-4 sm:px-6">
          <EventPassMark />
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,0.85fr)_minmax(22rem,1fr)] lg:gap-14">
        <div className="min-w-0">
          <p className="mb-3 text-sm font-medium text-muted-foreground">
            In-person event
          </p>
          <h1 className="text-3xl font-headline text-balance sm:text-4xl">
            {event.name}
          </h1>
          <p className="mt-6 max-w-2xl whitespace-pre-wrap text-base leading-7 text-muted-foreground">
            {event.description}
          </p>

          <dl className="mt-10 divide-y border-y">
            <div className="grid gap-2 py-5 sm:grid-cols-[1.5rem_9rem_1fr] sm:items-start">
              <IconCalendarEvent aria-hidden="true" className="mt-0.5" />
              <dt className="font-medium">Schedule</dt>
              <dd className="text-muted-foreground">
                {formatRange(event.startsAt, event.endsAt, event.eventTimeZone)}
                <span className="mt-1 block text-sm">
                  Event Time Zone: {event.eventTimeZone}
                </span>
              </dd>
            </div>
            <div className="grid gap-2 py-5 sm:grid-cols-[1.5rem_9rem_1fr] sm:items-start">
              <IconMapPin aria-hidden="true" className="mt-0.5" />
              <dt className="font-medium">Venue</dt>
              <dd className="text-muted-foreground">
                <span className="block text-foreground">{event.venueName}</span>
                {event.venueAddress}
                {event.venueMapUrl ? (
                  <Link
                    href={event.venueMapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 flex w-fit items-center gap-1.5 text-sm font-medium text-foreground underline underline-offset-4"
                  >
                    Open map
                    <IconExternalLink aria-hidden="true" className="size-4" />
                  </Link>
                ) : null}
              </dd>
            </div>
          </dl>
        </div>

        <aside className="h-fit rounded-2xl border bg-background p-5 sm:p-6">
          <h2 className="text-xl font-semibold">Registration</h2>
          <div className="mt-5 flex gap-3">
            <IconClock aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Registration window</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {formatMoment(event.registrationOpensAt, event.eventTimeZone)}
                <br />
                through {formatMoment(event.registrationClosesAt, event.eventTimeZone)}
              </p>
            </div>
          </div>
          <div className="mt-5 flex gap-3 border-t pt-5">
            <IconUsers aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Event Capacity</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {event.capacity.toLocaleString()} Attendees
              </p>
            </div>
          </div>
          {registration ? <div className="mt-6 border-t pt-6">{registration}</div> : null}
        </aside>
      </main>
    </div>
  );
}
