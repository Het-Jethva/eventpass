import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

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
    <>
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-tight">
          Registration form
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Name and email are always collected. Add only the Event-specific
          questions Attendees need to answer.
        </p>
      </div>

      <RegistrationFormBuilder eventId={event.id} initialFields={fields} />
    </>
  );
}
