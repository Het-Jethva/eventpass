import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  IconArrowLeft,
  IconDownload,
  IconFileSpreadsheet,
} from "@tabler/icons-react";

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
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <Link
          href={`/events/${currentEvent.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <IconArrowLeft aria-hidden="true" className="size-4" />
          Event overview
        </Link>
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <IconFileSpreadsheet aria-hidden="true" className="size-6" />
              <h1 className="text-2xl font-semibold tracking-tight">Registrations</h1>
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
      </div>

      <RegistrationImportWorkspace eventId={currentEvent.id} />
    </main>
  );
}
