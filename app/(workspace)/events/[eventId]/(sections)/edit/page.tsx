import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import type { CreateEventFormField } from "@/app/(workspace)/events/new/actions";
import { CreateEventForm } from "@/features/events/create-event-form";
import { utcToLocalDateTimeInput } from "@/features/events/server/event-schedule";
import { getOrganizerEvent } from "@/features/events/server/get-event";
import { getActiveStaffSession } from "@/lib/staff-session";

export const metadata: Metadata = { title: "Settings" };

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const staffSession = await getActiveStaffSession();
  if (!staffSession) redirect("/sign-in");

  const event = await getOrganizerEvent(eventId, staffSession.user.id);
  if (!event || event.status === "canceled") notFound();

  const local = (date: Date) => utcToLocalDateTimeInput(date, event.eventTimeZone);
  const initialValues = {
    name: event.name,
    description: event.description,
    slug: event.slug,
    eventTimeZone: event.eventTimeZone,
    startsAtLocal: local(event.startsAt),
    endsAtLocal: local(event.endsAt),
    venueName: event.venueName,
    venueAddress: event.venueAddress,
    venueMapUrl: event.venueMapUrl ?? "",
    capacity: String(event.capacity),
    registrationOpensAtLocal: local(event.registrationOpensAt),
    registrationClosesAtLocal: local(event.registrationClosesAt),
    checkInOpensAtLocal: local(event.checkInOpensAt),
    checkInClosesAtLocal: local(event.checkInClosesAt),
  } satisfies Record<CreateEventFormField, string>;

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-headline">Settings</h1>
        <p className="max-w-2xl text-support text-muted-foreground">
          {event.status === "draft"
            ? "Changes stay private until you publish. The public web address is fixed once you do."
            : "Significant changes are recorded and emailed to everyone affected. Restrictions tighten once check-in opens."}
        </p>
      </div>
      <CreateEventForm
        eventId={event.id}
        initialValues={initialValues}
        slugImmutable={Boolean(event.publishedAt)}
        published={event.status === "published"}
      />
    </>
  );
}
