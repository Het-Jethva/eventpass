import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { IconHistory } from "@tabler/icons-react";

import { AuditView } from "@/features/audit/audit-view";
import { getEventAuditLog } from "@/features/audit/server/get-audit-log";
import { getOrganizerEvent } from "@/features/events/server/get-event";
import { getActiveStaffSession } from "@/lib/staff-session";

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
    <>
      <div className="flex items-center gap-3">
        <IconHistory aria-hidden="true" className="size-6 text-muted-foreground" />
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Audit log</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Immutable, append-only records of privileged changes and Scan
            Attempts.
          </p>
        </div>
      </div>

      <AuditView eventId={currentEvent.id} initialRecords={auditRecords} />
    </>
  );
}
