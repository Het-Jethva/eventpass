import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import type { CreateEventFormField } from "@/app/(workspace)/events/new/actions";
import { CreateEventForm } from "@/features/events/create-event-form";
import { utcToLocalDateTimeInput } from "@/features/events/server/event-schedule";
import { getOrganizerEvent } from "@/features/events/server/get-event";
import { getActiveStaffSession } from "@/lib/staff-session";

export const metadata: Metadata = { title: "Configure Draft Event" };

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const staffSession = await getActiveStaffSession();
  if (!staffSession) redirect("/sign-in");

  const event = await getOrganizerEvent(eventId, staffSession.user.id);
  if (!event || event.status !== "draft") notFound();

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
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">Draft Event</p>
        <h1 className="text-2xl font-semibold tracking-tight">Configure {event.name}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Changes remain private until you publish. The Event Slug becomes immutable at publication.
        </p>
      </div>
      <CreateEventForm
        eventId={event.id}
        initialValues={initialValues}
        slugImmutable={Boolean(event.publishedAt)}
      />
    </main>
  );
}
