import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";

import { getOrganizerEvent } from "@/features/events/server/get-event";
import { getActiveStaffSession } from "@/lib/staff-session";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { EventSidebar } from "./event-sidebar";

// Every section of the event workspace shares this shell, so the event's
// identity and the way back are structural rather than something each page
// remembers to render. Before this existed the nav was copy-pasted into five
// pages and missing from three, and `edit` — reachable from the Settings tab —
// had neither nav nor a back link, leaving no way out but the browser button.
//
// The shell is a rail rather than a stack of header bands: the back-link, the
// section nav, and the event title used to occupy three rows above every page,
// under the global header, for four bands of chrome before any content. The
// rail carries all of that and hands the content column its width back, which
// the registrations and Audit tables needed most.
//
// `preview` deliberately sits outside this route group: it exists to show the
// Organizer the attendee-facing page, so workspace chrome would defeat it.
export default async function EventWorkspaceSectionsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const staffSession = await getActiveStaffSession();
  if (!staffSession) redirect("/sign-in");

  const event = await getOrganizerEvent(eventId, staffSession.user.id);
  if (!event) notFound();

  const isDraft = event.status === "draft";
  const isCanceled = event.status === "canceled";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col lg:flex-row">
      <EventSidebar
        eventId={event.id}
        eventName={event.name}
        eventSlug={event.slug}
        statusLabel={isDraft ? "Draft" : isCanceled ? "Canceled" : "Published"}
        statusVariant={
          isDraft ? "secondary" : isCanceled ? "destructive" : "default"
        }
        showScanner={event.status === "published"}
        showPublicPage={!isDraft}
      />

      <main className="flex min-w-0 flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {event.suspended ? (
          <Alert variant="warning">
            <AlertTitle>Event currently unavailable</AlertTitle>
            <AlertDescription>
              Event changes and new admission activity are temporarily paused.
              Read-only history, Registrations, Check-ins, metrics, and exports
              remain available.
            </AlertDescription>
          </Alert>
        ) : null}
        {children}
      </main>
    </div>
  );
}
