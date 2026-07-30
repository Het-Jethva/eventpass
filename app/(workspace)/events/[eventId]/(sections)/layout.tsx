import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  IconArrowLeft,
  IconExternalLink,
  IconScan,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getOrganizerEvent } from "@/features/events/server/get-event";
import { getActiveStaffSession } from "@/lib/staff-session";

import { EventWorkspaceNav } from "./event-workspace-nav";

// Every section of the Event workspace shares this shell, so the Event's
// identity and the way back are structural rather than something each page
// remembers to render. Before this existed the nav was copy-pasted into five
// pages and missing from three, and `edit` — reachable from the Settings tab —
// had neither nav nor a back link, leaving no way out but the browser button.
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
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-6">
        <Link
          href="/events"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <IconArrowLeft aria-hidden="true" className="size-4" />
          Events
        </Link>

        <EventWorkspaceNav eventId={event.id} eventName={event.name} />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {event.name}
              </h1>
              <Badge
                variant={
                  isDraft ? "secondary" : isCanceled ? "destructive" : "default"
                }
              >
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
            {event.status === "published" ? (
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
      </header>

      {children}
    </main>
  );
}
