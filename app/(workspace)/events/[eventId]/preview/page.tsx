import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { IconArrowLeft } from "@tabler/icons-react";

import { buttonVariants } from "@/components/ui/button";
import { EventPublicDetails } from "@/features/events/event-public-details";
import { getOrganizerEvent } from "@/features/events/server/get-event";
import { getActiveStaffSession } from "@/lib/staff-session";

export const metadata: Metadata = { title: "Event preview" };

export default async function EventPreviewPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const staffSession = await getActiveStaffSession();
  if (!staffSession) redirect("/sign-in");

  const event = await getOrganizerEvent(eventId, staffSession.user.id);
  if (!event) notFound();

  return (
    <div className="relative">
      <div className="sticky top-0 z-10 border-b bg-foreground text-background">
        <div className="mx-auto flex min-h-12 max-w-5xl items-center justify-between gap-4 px-4 py-2 text-sm sm:px-6">
          <p><span className="font-medium">Preview:</span> this page is visible only to organizers.</p>
          <Link href={`/events/${event.id}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
            <IconArrowLeft data-icon="inline-start" />
            Back to event
          </Link>
        </div>
      </div>
      <EventPublicDetails event={event} />
    </div>
  );
}
