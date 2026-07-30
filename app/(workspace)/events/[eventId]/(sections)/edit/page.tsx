import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import type { CreateEventFormField } from "@/app/(workspace)/events/new/actions";
import { CreateEventForm } from "@/features/events/create-event-form";
import { utcToLocalDateTimeInput } from "@/features/events/server/event-schedule";
import { getOrganizerEvent } from "@/features/events/server/get-event";
import { getActiveStaffSession } from "@/lib/staff-session";

export const metadata: Metadata = { title: "Configure Event" };

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
        <h2 className="text-xl font-semibold tracking-tight">Settings</h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {event.status === "draft"
            ? "Changes remain private until you publish. The Event Slug becomes immutable at publication."
            : "Material changes are recorded and emailed to affected Attendees. Restrictions tighten when check-in opens."}
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
