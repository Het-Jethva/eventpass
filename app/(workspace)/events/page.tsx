import type { Metadata } from "next";
import { ViewTransition } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  IconCalendarEvent,
  IconMapPin,
  IconPlus,
  IconUsers,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { listStaffEvents } from "@/features/events/server/list-staff-events";
import { getActiveStaffSession } from "@/lib/staff-session";

export const metadata: Metadata = {
  title: "Events",
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Event owner",
  organizer: "Organizer",
  check_in_volunteer: "Check-in volunteer",
};

function formatSchedule(startsAt: Date, endsAt: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  });

  return formatter.formatRange(startsAt, endsAt);
}

export default async function EventsPage() {
  const staffSession = await getActiveStaffSession();

  if (!staffSession) {
    redirect("/sign-in");
  }

  const events = await listStaffEvents(staffSession.user.id);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-headline">Events</h1>
          <p className="text-sm text-muted-foreground">
            Events you work on.
          </p>
        </div>
        <Link href="/events/new" className={buttonVariants()}>
          <IconPlus data-icon="inline-start" />
          Create event
        </Link>
      </div>

      {events.length === 0 ? (
        <Empty className="min-h-80 border bg-background">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconCalendarEvent aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>No events yet</EmptyTitle>
            <EmptyDescription>
              Create a draft to configure registration, staffing, and
              check-in before anything becomes visible to attendees.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link href="/events/new" className={buttonVariants()}>
              <IconPlus data-icon="inline-start" />
              Create your first event
            </Link>
          </EmptyContent>
        </Empty>
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-background">
          {events.map((eventItem) => (
            <li
              key={eventItem.id}
              className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Morphs into the event name in the workspace rail, so
                      opening an event reads as the same thing moving rather
                      than one page replacing another. The `event-` prefix
                      matters: a view-transition-name is a CSS custom-ident and
                      cannot begin with a digit, which a bare UUID may. */}
                  <ViewTransition name={`event-${eventItem.id}`}>
                    <h2 className="truncate font-medium">{eventItem.name}</h2>
                  </ViewTransition>
                  <Badge variant={eventItem.status === "draft" ? "secondary" : "default"}>
                    {eventItem.status === "draft" ? "Draft" : "Published"}
                  </Badge>
                  <Badge variant="outline">
                    {ROLE_LABELS[eventItem.role] ?? eventItem.role}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatSchedule(
                    eventItem.startsAt,
                    eventItem.endsAt,
                    eventItem.eventTimeZone,
                  )}
                </p>
              </div>
              {/* Metadata first, then the action. The button used to sit
                  between the venue and the capacity, so the one thing you came
                  to click was the third item in a row of facts — and because
                  the row wrapped on content width, no two rows lined up. */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground sm:flex-nowrap sm:justify-end">
                {/* size-4, like every other icon set beside 14px text in the
                    product. These two were the only ones left at the library's
                    24px default, which put a pin and a pair of figures taller
                    than the venue name they were labelling. */}
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <IconMapPin aria-hidden="true" className="size-4 shrink-0" />
                  <span className="truncate">{eventItem.venueName}</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1.5 tabular-nums">
                  <IconUsers aria-hidden="true" className="size-4" />
                  Capacity {eventItem.capacity.toLocaleString()}
                </span>
                <Link
                  href={`/events/${eventItem.id}`}
                  className={buttonVariants({ variant: "outline", size: "sm", className: "shrink-0" })}
                >
                  Open
                  <span className="sr-only"> {eventItem.name}</span>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
