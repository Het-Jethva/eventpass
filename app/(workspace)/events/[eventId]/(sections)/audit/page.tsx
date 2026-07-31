import type { Metadata } from "next";
import { Suspense, ViewTransition } from "react";
import { notFound, redirect } from "next/navigation";

import { AuditView } from "@/features/audit/audit-view";
import { AuditViewSkeleton } from "@/features/audit/audit-view-skeleton";
import {
  parseAuditCategory,
  parseAuditSource,
} from "@/features/audit/audit-filters";
import { queryEventAuditLog } from "@/features/audit/server/audit-log";
import {
  decodeAuditCursor,
  encodeAuditCursor,
  type AuditCategory,
  type AuditSourceFilter,
} from "@/features/audit/server/get-audit-log";
import { getOrganizerEvent } from "@/features/events/server/get-event";
import { getActiveStaffSession } from "@/lib/staff-session";

export const metadata: Metadata = { title: "Audit log" };

type AuditSearchParams = {
  q?: string;
  category?: string;
  source?: string;
  cursor?: string;
};

export default async function EventAuditPage(props: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<AuditSearchParams>;
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
  const category = parseAuditCategory(query.category);
  const source = parseAuditSource(query.source);

  return (
    <>
      {/* No icon beside the title: every other section header in the workspace
          is the word alone, and one decorated heading reads as an accident. */}
      <div>
        <h1 className="text-2xl font-headline">Audit log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A permanent record of who changed what, and every scan at the door.
          Nothing here can be edited or removed.
        </p>
      </div>

      {/* Two of the three permitted motion patterns land on the same boundary:
          the skeleton resolving into real rows, and the crossfade when a filter
          or cursor changes the key. Both communicate that this is the same
          table with different contents rather than a new page. */}
      <ViewTransition name="audit-results">
        <Suspense
          key={`${searchQuery}|${category}|${source}|${query.cursor ?? ""}`}
          fallback={<AuditViewSkeleton />}
        >
          <AuditResults
            eventId={currentEvent.id}
            actorUserId={session.user.id}
            searchQuery={searchQuery}
            category={category}
            source={source}
            cursorParam={query.cursor}
            basePath={`/events/${currentEvent.id}/audit`}
          />
        </Suspense>
      </ViewTransition>
    </>
  );
}

async function AuditResults({
  eventId,
  actorUserId,
  searchQuery,
  category,
  source,
  cursorParam,
  basePath,
}: {
  eventId: string;
  actorUserId: string;
  searchQuery: string;
  category: AuditCategory;
  source: AuditSourceFilter;
  cursorParam: string | undefined;
  basePath: string;
}) {
  const log = await queryEventAuditLog({
    eventId,
    actorUserId,
    searchQuery,
    category,
    source,
    cursor: decodeAuditCursor(cursorParam),
  });

  const nextHref = log.nextCursor
    ? (() => {
        const params = new URLSearchParams();
        if (searchQuery) params.set("q", searchQuery);
        if (category !== "all") params.set("category", category);
        if (source !== "all") params.set("source", source);
        params.set("cursor", encodeAuditCursor(log.nextCursor));
        return `${basePath}?${params.toString()}`;
      })()
    : null;

  return (
    <AuditView
      log={log}
      category={category}
      source={source}
      initialQuery={searchQuery}
      nextHref={nextHref}
    />
  );
}
