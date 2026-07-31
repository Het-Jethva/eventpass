import type { Metadata } from "next";

import { CreateEventForm } from "@/features/events/create-event-form";
import type { CreateEventFormField } from "./actions";
import { utcToLocalDateTimeInput } from "@/features/events/server/event-schedule";

export const metadata: Metadata = {
  title: "Create draft",
};

export default function NewEventPage() {
  const eventTimeZone = "Asia/Kolkata";
  const initialValues = {
    name: "",
    description: "",
    slug: "",
    eventTimeZone,
    startsAtLocal: "",
    endsAtLocal: "",
    venueName: "",
    venueAddress: "",
    venueMapUrl: "",
    capacity: "",
    registrationOpensAtLocal: utcToLocalDateTimeInput(new Date(), eventTimeZone),
    registrationClosesAtLocal: "",
    checkInOpensAtLocal: "",
    checkInClosesAtLocal: "",
  } satisfies Record<CreateEventFormField, string>;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">Events</p>
        <h1 className="text-2xl font-headline">
          Create a draft event
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          drafts are visible only to assigned staff. You can review
          and publish this event after its configuration is complete.
        </p>
      </div>
      <CreateEventForm initialValues={initialValues} />
    </main>
  );
}
