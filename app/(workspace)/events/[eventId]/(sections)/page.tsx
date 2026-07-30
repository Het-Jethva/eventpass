import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  IconArrowLeft,
  IconCalendarEvent,
  IconClockQuestion,
  IconExternalLink,
  IconMapPin,
  IconScan,
  IconSend,
  IconUsers,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getOrganizerEvent } from "@/features/events/server/get-event";
import { getOrganizerEventMetrics } from "@/features/events/server/get-event-metrics";
import { LiveMetricsDashboard } from "@/features/events/live-metrics-dashboard";
import { getActiveStaffSession } from "@/lib/staff-session";
import { cn } from "@/lib/utils";
import { DeleteEventControl } from "@/features/events/delete-event-control";
import { CancelEventControl } from "@/features/events/cancel-event-control";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EventWorkspaceNav } from "./event-workspace-nav";

import {
  deleteEventAction,
  cancelEventAction,
  publishEventAction,
  returnEventToDraftAction,
} from "./actions";

export const metadata: Metadata = { title: "Event Overview" };

function formatRange(startsAt: Date, endsAt: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
    timeZoneName: "short",
  }).formatRange(startsAt, endsAt);
}

export default async function EventOverviewPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const staffSession = await getActiveStaffSession();
  if (!staffSession) redirect("/sign-in");

  const [event, initialMetrics] = await Promise.all([
    getOrganizerEvent(eventId, staffSession.user.id),
    getOrganizerEventMetrics(eventId, staffSession.user.id),
  ]);

  if (!event || !initialMetrics) notFound();

  const isDraft = event.status === "draft";
  const isPublished = event.status === "published";
  const isCanceled = event.status === "canceled";
  const isOwner = event.role === "owner";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <Link
          href="/events"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <IconArrowLeft aria-hidden="true" className="size-4" />
          Events
        </Link>

        <div className="mt-4 mb-6">
          <EventWorkspaceNav eventId={event.id} eventName={event.name} />
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {event.name}
              </h1>
              <Badge variant={isDraft ? "secondary" : isCanceled ? "destructive" : "default"}>
                {isDraft
                  ? "Draft Event"
                  : isCanceled
                    ? "Canceled Event"
                    : "Published Event"}
              </Badge>
            </div>
            <p className="mt-2 font-mono text-sm text-muted-foreground">
              /e/{event.slug}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isPublished ? (
              <Link href={`/scanner/${event.id}`} className={buttonVariants()}>
                <IconScan data-icon="inline-start" />
                Open scanner
              </Link>
            ) : null}
            {!isDraft ? (
              <Link
                href={`/e/${event.slug}`}
                target="_blank"
                className={buttonVariants({ variant: "outline" })}
              >
                <IconExternalLink data-icon="inline-end" />
                Open public page
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {isCanceled ? (
        <Alert variant="destructive">
          <IconClockQuestion aria-hidden="true" />
          <AlertTitle>This Event was canceled</AlertTitle>
          <AlertDescription>
            {event.cancellationReason} All active Tickets are invalid, and
            Registration and admission are closed. Operational history remains
            available.
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Live Operational Metrics Dashboard */}
      <LiveMetricsDashboard eventId={event.id} initialMetrics={initialMetrics} />

      {/* Configuration Details Section */}
      <section
        className="divide-y rounded-2xl border bg-background"
        aria-labelledby="configuration-heading"
      >
        <div className="p-5 sm:p-6">
          <h2 id="configuration-heading" className="font-medium">
            Event configuration
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The attendee-facing schedule, Venue, and admission limits.
          </p>
        </div>
        <dl className="grid gap-6 p-5 sm:grid-cols-2 sm:p-6">
          <div className="flex gap-3">
            <IconCalendarEvent aria-hidden="true" className="mt-0.5 size-5" />
            <div>
              <dt className="text-sm font-medium">Schedule</dt>
              <dd className="mt-1 text-sm leading-6 text-muted-foreground">
                {formatRange(event.startsAt, event.endsAt, event.eventTimeZone)}
              </dd>
            </div>
          </div>
          <div className="flex gap-3">
            <IconMapPin aria-hidden="true" className="mt-0.5 size-5" />
            <div>
              <dt className="text-sm font-medium">Venue</dt>
              <dd className="mt-1 text-sm leading-6 text-muted-foreground">
                {event.venueName}
                <br />
                {event.venueAddress}
              </dd>
            </div>
          </div>
          <div className="flex gap-3">
            <IconUsers aria-hidden="true" className="mt-0.5 size-5" />
            <div>
              <dt className="text-sm font-medium">Event Capacity</dt>
              <dd className="mt-1 text-sm text-muted-foreground">
                {event.capacity.toLocaleString()} Attendees
              </dd>
            </div>
          </div>
        </dl>
      </section>

      {isDraft ? (
        <section className="flex flex-col gap-5 border-t pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-medium">Publish this Event</h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Publishing makes the Event link-accessible and freezes its Event
              Slug. It will not be added to a public discovery index.
            </p>
          </div>
          <form action={publishEventAction.bind(null, event.id)}>
            <button
              className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}
            >
              <IconSend data-icon="inline-start" />
              Publish Event
            </button>
          </form>
        </section>
      ) : null}

      {isPublished ? (
        <section className="flex flex-col gap-5 border-t pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-medium">Return to Draft</h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              This hides the public page. The Event Slug remains frozen. Once an
              Event has a Registration, it can no longer return to Draft.
            </p>
          </div>
          <form action={returnEventToDraftAction.bind(null, event.id)}>
            <button className={buttonVariants({ variant: "outline" })}>
              Return to Draft
            </button>
          </form>
        </section>
      ) : null}

      {isPublished && isOwner ? (
        <section className="flex flex-col gap-5 border-t pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-medium">Cancel this Event</h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Only the Event Owner can cancel. Cancellation is immediate and
              irreversible, but preserves all records.
            </p>
          </div>
          <CancelEventControl
            action={cancelEventAction.bind(null, event.id)}
            eventName={event.name}
          />
        </section>
      ) : null}

      {isDraft && isOwner ? (
        <section className="flex flex-col gap-5 border-t pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-medium">Delete Draft Event</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Only the Event Owner can permanently delete this empty Draft
              Event.
            </p>
          </div>
          <DeleteEventControl
            action={deleteEventAction.bind(null, event.id)}
            eventName={event.name}
          />
        </section>
      ) : null}
    </main>
  );
}
