import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { IconDownload, IconFileSpreadsheet } from "@tabler/icons-react";

import { buttonVariants } from "@/components/ui/button";
import { getOrganizerEvent } from "@/features/events/server/get-event";
import { RegistrationImportWorkspace } from "@/features/registration-import/registration-import-workspace";
import { getActiveStaffSession } from "@/lib/staff-session";

export const metadata: Metadata = { title: "Registrations" };

export default async function RegistrationsPage(props: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await props.params;
  const session = await getActiveStaffSession();
  if (!session) redirect("/sign-in");
  const currentEvent = await getOrganizerEvent(eventId, session.user.id);
  if (!currentEvent) notFound();

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <IconFileSpreadsheet aria-hidden="true" className="size-6" />
            <h2 className="text-xl font-semibold tracking-tight">Registrations</h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Preview a bounded CSV before creating Organizer-attested
            Registrations, or export privacy-filtered operational data.
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

      <RegistrationImportWorkspace eventId={currentEvent.id} />
    </>
  );
}
