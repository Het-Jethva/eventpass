import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { IconDownload, IconFileSpreadsheet } from "@tabler/icons-react";

import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getOrganizerEvent } from "@/features/events/server/get-event";
import { parseRosterFilter } from "@/features/registration/roster-filters";
import { RosterSearchControls } from "@/features/registration/roster-search-controls";
import { RosterTable } from "@/features/registration/roster-table";
import { RosterTableSkeleton } from "@/features/registration/roster-table-skeleton";
import {
  decodeRosterCursor,
  encodeRosterCursor,
} from "@/features/registration/server/get-event-roster";
import { queryEventRoster } from "@/features/registration/server/event-roster";
import { RegistrationImportWorkspace } from "@/features/registration-import/registration-import-workspace";
import { getActiveStaffSession } from "@/lib/staff-session";

export const metadata: Metadata = { title: "Registrations" };

type RegistrationsSearchParams = {
  q?: string;
  status?: string;
  cursor?: string;
};

export default async function RegistrationsPage(props: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<RegistrationsSearchParams>;
}) {
  const [{ eventId }, query, session] = await Promise.all([
    props.params,
    props.searchParams,
    getActiveStaffSession(),
  ]);
  if (!session) redirect("/sign-in");

  const currentEvent = await getOrganizerEvent(eventId, session.user.id);
  if (!currentEvent) notFound();

  const searchQuery = query.q?.trim() ?? "";
  const filter = parseRosterFilter(query.status);
  const basePath = `/events/${currentEvent.id}/registrations`;

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <IconFileSpreadsheet aria-hidden="true" className="size-6" />
            <h1 className="font-heading text-3xl">Registrations</h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Who registered, whether they hold a valid Ticket, and whether they
            have been admitted. Search covers every Registration for this Event.
          </p>
        </div>
        <a
          href={`/api/events/${encodeURIComponent(currentEvent.id)}/registrations/export`}
          className={buttonVariants({ variant: "outline" })}
        >
          <IconDownload data-icon="inline-start" />
          Export CSV
        </a>
      </div>

      <RosterSearchControls activeFilter={filter} initialQuery={searchQuery} />

      {/*
        The results get their own boundary so the search input above stays
        mounted and interactive while the server refetches. Keying it on the
        active query makes a new search show the skeleton instead of holding the
        previous rows on screen, which would read as "no results yet".
      */}
      <Suspense
        key={`${searchQuery}|${filter}|${query.cursor ?? ""}`}
        fallback={<RosterTableSkeleton />}
      >
        <RosterResults
          eventId={currentEvent.id}
          actorUserId={session.user.id}
          eventTimeZone={currentEvent.eventTimeZone}
          searchQuery={searchQuery}
          filter={filter}
          cursorParam={query.cursor}
          basePath={basePath}
        />
      </Suspense>

      <Separator />

      <div>
        <h3 className="font-medium">Import Registrations</h3>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
          Preview a bounded CSV before creating Organizer-attested
          Registrations. Imports are all-or-nothing and stay within the Event
          Capacity.
        </p>
        <div className="mt-5">
          <RegistrationImportWorkspace eventId={currentEvent.id} />
        </div>
      </div>
    </>
  );
}

async function RosterResults({
  eventId,
  actorUserId,
  eventTimeZone,
  searchQuery,
  filter,
  cursorParam,
  basePath,
}: {
  eventId: string;
  actorUserId: string;
  eventTimeZone: string;
  searchQuery: string;
  filter: ReturnType<typeof parseRosterFilter>;
  cursorParam: string | undefined;
  basePath: string;
}) {
  const roster = await queryEventRoster({
    eventId,
    actorUserId,
    searchQuery,
    filter,
    cursor: decodeRosterCursor(cursorParam),
  });

  // Only an Organizer or Owner reaches this page, and `getOrganizerEvent`
  // already enforced that — so a null here means the assignment changed
  // mid-request rather than an ordinary denial.
  if (!roster) notFound();

  const nextHref = roster.nextCursor
    ? (() => {
        const params = new URLSearchParams();
        if (searchQuery) params.set("q", searchQuery);
        if (filter !== "all") params.set("status", filter);
        params.set("cursor", encodeRosterCursor(roster.nextCursor));
        return `${basePath}?${params.toString()}`;
      })()
    : null;

  return (
    <RosterTable
      roster={roster}
      eventTimeZone={eventTimeZone}
      nextHref={nextHref}
      hasActiveSearch={searchQuery.length > 0 || filter !== "all"}
    />
  );
}
