"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type {
  CreateEventFormField,
  CreateEventFormState,
} from "@/app/(workspace)/events/new/actions";
import { deleteDraftEvent } from "@/features/events/server/delete-draft-event";
import { publishEvent } from "@/features/events/server/publish-event";
import {
  EventSlugUnavailableError,
  EventSlugImmutableError,
  updateDraftEvent,
  updateDraftEventInputSchema,
} from "@/features/events/server/update-draft-event";
import { getActiveStaffSession } from "@/lib/staff-session";
import { returnEventToDraft } from "@/features/events/server/return-event-to-draft";

function formValue(formData: FormData, name: CreateEventFormField) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function formValues(formData: FormData) {
  return {
    name: formValue(formData, "name"),
    description: formValue(formData, "description"),
    slug: formValue(formData, "slug"),
    eventTimeZone: formValue(formData, "eventTimeZone"),
    startsAtLocal: formValue(formData, "startsAtLocal"),
    endsAtLocal: formValue(formData, "endsAtLocal"),
    venueName: formValue(formData, "venueName"),
    venueAddress: formValue(formData, "venueAddress"),
    venueMapUrl: formValue(formData, "venueMapUrl"),
    capacity: formValue(formData, "capacity"),
    registrationOpensAtLocal: formValue(formData, "registrationOpensAtLocal"),
    registrationClosesAtLocal: formValue(formData, "registrationClosesAtLocal"),
    checkInOpensAtLocal: formValue(formData, "checkInOpensAtLocal"),
    checkInClosesAtLocal: formValue(formData, "checkInClosesAtLocal"),
  } satisfies Record<CreateEventFormField, string>;
}

export async function updateEventAction(
  eventId: string,
  _previousState: CreateEventFormState,
  formData: FormData,
): Promise<CreateEventFormState> {
  const staffSession = await getActiveStaffSession();
  if (!staffSession) redirect("/sign-in");

  const values = formValues(formData);
  const validation = updateDraftEventInputSchema.safeParse(values);

  if (!validation.success) {
    return {
      status: "error",
      message: "Review the highlighted fields and try again.",
      fieldErrors: validation.error.flatten().fieldErrors,
      values,
    };
  }

  try {
    await updateDraftEvent(eventId, staffSession.user.id, values);
  } catch (error) {
    if (
      error instanceof EventSlugUnavailableError ||
      error instanceof EventSlugImmutableError
    ) {
      return {
        status: "error",
        message: error.message,
        fieldErrors: { slug: [error.message] },
        values,
      };
    }

    return {
      status: "error",
      message: "The Draft Event could not be saved. It may no longer be editable.",
      values,
    };
  }

  revalidatePath("/events");
  revalidatePath(`/events/${eventId}`);
  redirect(`/events/${eventId}`);
}

export async function publishEventAction(eventId: string) {
  const staffSession = await getActiveStaffSession();
  if (!staffSession) redirect("/sign-in");

  const publishedEvent = await publishEvent(eventId, staffSession.user.id);
  revalidatePath("/events");
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/e/${publishedEvent.slug}`);
  redirect(`/events/${eventId}`);
}

export async function deleteEventAction(eventId: string) {
  const staffSession = await getActiveStaffSession();
  if (!staffSession) redirect("/sign-in");

  await deleteDraftEvent(eventId, staffSession.user.id);
  revalidatePath("/events");
  redirect("/events");
}

export async function returnEventToDraftAction(eventId: string) {
  const staffSession = await getActiveStaffSession();
  if (!staffSession) redirect("/sign-in");

  const draftEvent = await returnEventToDraft(eventId, staffSession.user.id);
  revalidatePath("/events");
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/e/${draftEvent.slug}`);
  redirect(`/events/${eventId}`);
}
