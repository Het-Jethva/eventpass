import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { IconArrowLeft } from "@tabler/icons-react";

import { buttonVariants } from "@/components/ui/button";
import { getOrganizerEvent } from "@/features/events/server/get-event";
import { RegistrationFormBuilder } from "@/features/registration/registration-form-builder";
import { getOrganizerRegistrationForm } from "@/features/registration/server/registration-form";
import { getActiveStaffSession } from "@/lib/staff-session";

export const metadata: Metadata = { title: "Registration form" };

export default async function RegistrationFormPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const staffSession = await getActiveStaffSession();
  if (!staffSession) redirect("/sign-in");

  const [event, fields] = await Promise.all([
    getOrganizerEvent(eventId, staffSession.user.id),
    getOrganizerRegistrationForm(eventId, staffSession.user.id).catch(() => null),
  ]);
  if (!event || !fields) notFound();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-5">
        <Link
          href={`/events/${event.id}`}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <IconArrowLeft data-icon="inline-start" />
          {event.name}
        </Link>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Registration form
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Name and email are always collected. Add only the Event-specific
            questions Attendees need to answer.
          </p>
        </div>
      </div>

      <RegistrationFormBuilder eventId={event.id} initialFields={fields} />
    </main>
  );
}
