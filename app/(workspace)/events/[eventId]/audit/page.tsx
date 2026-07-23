import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { IconArrowLeft, IconHistory } from "@tabler/icons-react";

import { AuditView } from "@/features/audit/audit-view";
import { getEventAuditLog } from "@/features/audit/server/get-audit-log";
import { getOrganizerEvent } from "@/features/events/server/get-event";
import { getActiveStaffSession } from "@/lib/staff-session";
import { EventWorkspaceNav } from "../event-workspace-nav";

export const metadata: Metadata = { title: "Audit log" };

export default async function EventAuditPage(props: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await props.params;
  const session = await getActiveStaffSession();
  if (!session) redirect("/sign-in");

  const currentEvent = await getOrganizerEvent(eventId, session.user.id);
  if (!currentEvent) notFound();

  const auditRecords = await getEventAuditLog({
    eventId: currentEvent.id,
    actorUserId: session.user.id,
  });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <Link
          href={`/events/${currentEvent.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <IconArrowLeft aria-hidden="true" className="size-4" />
          Event Overview
        </Link>

        <div className="mt-4 mb-6">
          <EventWorkspaceNav eventId={currentEvent.id} eventName={currentEvent.name} />
        </div>

        <div className="flex items-center gap-3">
          <IconHistory aria-hidden="true" className="size-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Immutable, append-only records of privileged changes and Scan Attempts for {currentEvent.name}.
            </p>
          </div>
        </div>
      </div>

      <AuditView eventId={currentEvent.id} initialRecords={auditRecords} />
    </main>
  );
}
