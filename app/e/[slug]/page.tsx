import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EventPublicDetails } from "@/features/events/event-public-details";
import { getPublishedEvent } from "@/features/events/server/get-event";

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

  return <EventPublicDetails event={event} />;
}
