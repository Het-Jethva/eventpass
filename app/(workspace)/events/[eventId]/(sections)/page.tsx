import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import {
  IconCalendarEvent,
  IconClockQuestion,
  IconMapPin,
  IconSend,
  IconUsers,
  IconArrowRight,
} from "@tabler/icons-react";

import { FormSubmitButton } from "@/components/form-submit-button";
import { getOrganizerEvent } from "@/features/events/server/get-event";
import { getOrganizerEventMetrics } from "@/features/events/server/get-event-metrics";
import { LiveMetricsDashboard } from "@/features/events/live-metrics-dashboard";
import { LiveMetricsSkeleton } from "@/features/events/live-metrics-skeleton";
import { getActiveStaffSession } from "@/lib/staff-session";
import { DeleteEventControl } from "@/features/events/delete-event-control";
import { CancelEventControl } from "@/features/events/cancel-event-control";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PendingLink } from "@/components/pending-link";
import { buttonVariants } from "@/components/ui/button";

import {
  deleteEventAction,
  cancelEventAction,
  publishEventAction,
  returnEventToDraftAction,
} from "../actions";

export const metadata: Metadata = { title: "Event Overview" };

function formatRange(startsAt: Date, endsAt: Date, timeZone: string) {
  // `dateStyle`/`timeStyle` cannot be combined with `timeZoneName` — ECMA-402
  // rejects the mix and `Intl.DateTimeFormat` throws "Invalid option : option".
  // The Event Time Zone has to stay visible, so spell the components out.
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).formatRange(startsAt, endsAt);
}

async function EventMetrics({
  eventId,
  eventSlug,
  staffUserId,
}: {
  eventId: string;
  eventSlug: string;
  staffUserId: string;
}) {
  const initialMetrics = await getOrganizerEventMetrics(eventId, staffUserId);
  if (!initialMetrics) notFound();

  return (
    <LiveMetricsDashboard
      eventId={eventId}
      eventSlug={eventSlug}
      initialMetrics={initialMetrics}
    />
  );
}

export default async function EventOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { eventId } = await params;
  const query = await searchParams;
  const staffSession = await getActiveStaffSession();
  if (!staffSession) redirect("/sign-in");

  const event = await getOrganizerEvent(eventId, staffSession.user.id);

  if (!event) notFound();

  const isDraft = event.status === "draft";
  const isPublished = event.status === "published";
  const isCanceled = event.status === "canceled";
  const isOwner = event.role === "owner";

  return (
    <>
      <h1 className="text-2xl font-headline">Overview</h1>

      {query.error === "unavailable" ? (
        <Alert variant="warning">
          <IconClockQuestion aria-hidden="true" />
          <AlertTitle>Event currently unavailable</AlertTitle>
          <AlertDescription>
            This Event is currently unavailable. Event changes are temporarily
            paused; operational history remains available.
          </AlertDescription>
        </Alert>
      ) : query.error ? (
        <Alert variant="warning">
          <IconClockQuestion aria-hidden="true" />
          <AlertTitle>Event not deleted</AlertTitle>
          <AlertDescription>{query.error}</AlertDescription>
        </Alert>
      ) : null}

      {isCanceled ? (
        <Alert variant="destructive">
          <IconClockQuestion aria-hidden="true" />
          <AlertTitle>This event was canceled</AlertTitle>
          <AlertDescription>
            {event.cancellationReason} All active tickets are invalid, and
            Registration and admission are closed. Operational history remains
            available.
          </AlertDescription>
        </Alert>
      ) : null}

      {isDraft ? (
        <section
          aria-labelledby="setup-heading"
          className="flex flex-col gap-5"
        >
          <div className="flex flex-col gap-2">
            <h2
              id="setup-heading"
              className="text-3xl font-headline text-balance"
            >
              Get ready to welcome your guests.
            </h2>
            <p className="max-w-xl text-support text-muted-foreground">
              Your draft is private. Review the details below, choose what to
              ask guests, then publish when you’re ready.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="#publish-event"
              className={buttonVariants({ size: "lg", className: "min-h-11" })}
            >
              Jump to publishing details
            </a>
            <p className="text-sm text-muted-foreground">
              Event details saved. Custom questions and team invitations are
              optional.
            </p>
          </div>
          <ul className="divide-y border-y">
            {[
              {
                title: "Review event details",
                description:
                  "Check the schedule, venue, capacity, and registration times.",
                path: "edit",
              },
              {
                title: "Customize registration",
                description:
                  "Name and email are included. Add any other questions you need.",
                path: "form",
              },
              {
                title: "Invite your door team",
                description:
                  "Optional now. Add organizers and volunteers before doors open.",
                path: "staff",
              },
            ].map((item) => (
              <li key={item.path}>
                <PendingLink
                  href={`/events/${event.id}/${item.path}`}
                  aria-label={item.title}
                  className="flex min-h-14 items-center justify-between gap-4 rounded-md px-3 py-4 transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30"
                >
                  <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-medium">{item.title}</h3>
                    <p className="hidden text-sm text-muted-foreground sm:block">
                      {item.description}
                    </p>
                  </div>
                  <IconArrowRight
                    aria-hidden="true"
                    className="size-4 shrink-0"
                  />
                </PendingLink>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <Suspense fallback={<LiveMetricsSkeleton />}>
          <EventMetrics
            eventId={event.id}
            eventSlug={event.slug}
            staffUserId={staffSession.user.id}
          />
        </Suspense>
      )}

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
            The schedule, place, and limits attendees see.
          </p>
        </div>
        <dl className="grid gap-6 p-5 sm:grid-cols-2 sm:p-6">
          <div>
            <dt className="flex items-center gap-3 text-sm font-medium">
              <IconCalendarEvent aria-hidden="true" className="size-5" />
              Schedule
            </dt>
            <dd className="mt-1 pl-8 text-support text-muted-foreground">
              {formatRange(event.startsAt, event.endsAt, event.eventTimeZone)}
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-3 text-sm font-medium">
              <IconMapPin aria-hidden="true" className="size-5" />
              Venue
            </dt>
            <dd className="mt-1 pl-8 text-support text-muted-foreground">
              {event.venueName}
              <br />
              {event.venueAddress}
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-3 text-sm font-medium">
              <IconUsers aria-hidden="true" className="size-5" />
              Capacity
            </dt>
            <dd className="mt-1 pl-8 text-sm text-muted-foreground">
              {event.capacity.toLocaleString()} places
            </dd>
          </div>
        </dl>
      </section>

      {isDraft ? (
        <section
          id="publish-event"
          className="flex flex-col gap-5 border-t pt-8 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h2 className="font-medium">Publish this event</h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Anyone with the link can see it, and the web address is fixed from
              then on. It is never listed in a public directory.
            </p>
          </div>
          <form action={publishEventAction.bind(null, event.id)}>
            <FormSubmitButton
              pendingLabel="Publishing event"
              size="lg"
              className="w-full sm:w-auto"
            >
              <IconSend data-icon="inline-start" />
              Publish event
            </FormSubmitButton>
          </form>
        </section>
      ) : null}

      {isPublished ? (
        <section className="flex flex-col gap-5 border-t pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-medium">Return to draft</h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              This hides the public page. The web address stays reserved. Once
              an event has a registration, it can no longer return to draft.
            </p>
          </div>
          <form action={returnEventToDraftAction.bind(null, event.id)}>
            <FormSubmitButton
              pendingLabel="Returning to draft"
              variant="outline"
            >
              Return to draft
            </FormSubmitButton>
          </form>
        </section>
      ) : null}

      {isPublished && isOwner ? (
        <section className="flex flex-col gap-5 border-t pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-medium">Cancel this event</h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Only the event owner can cancel. Cancellation is immediate and
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
            <h2 className="font-medium">Delete draft</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Only the event owner can permanently delete this empty draft
              Event.
            </p>
          </div>
          <DeleteEventControl
            action={deleteEventAction.bind(null, event.id)}
            eventName={event.name}
          />
        </section>
      ) : null}
    </>
  );
}
