import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EventPublicDetails } from "@/features/events/event-public-details";
import { getPublishedEvent } from "@/features/events/server/get-event";
import { AttendeeRegistrationForm } from "@/features/registration/attendee-registration-form";
import { getPublicRegistrationForm } from "@/features/registration/server/get-public-registration-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await getPublishedEvent(slug);

  return event
    ? { title: event.name, description: event.description }
    : { title: "Event not found" };
}

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getPublishedEvent(slug);

  if (!event) {
    notFound();
  }

  const fields = await getPublicRegistrationForm(event.id);
  const now = new Date();
  const registrationIsOpen =
    now >= event.registrationOpensAt && now < event.registrationClosesAt;

  return (
    <EventPublicDetails
      event={event}
      registration={
        registrationIsOpen ? (
          <AttendeeRegistrationForm slug={slug} fields={fields} />
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            Registration is not currently open for this Event.
          </p>
        )
      }
    />
  );
}
