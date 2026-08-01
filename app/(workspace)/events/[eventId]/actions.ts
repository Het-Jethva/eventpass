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
import { getOrganizerEvent } from "@/features/events/server/get-event";
import {
  cancelPublishedEvent,
  updatePublishedEvent,
} from "@/features/events/server/published-events";
import {
  EventCapacityConflictError,
  PublishedEventChangeError,
} from "@/features/events/server/published-event-application";
import { EventSuspendedError } from "@/features/events/server/event-suspension";

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
    const currentEvent = await getOrganizerEvent(eventId, staffSession.user.id);
    if (currentEvent?.status === "published") {
      await updatePublishedEvent(eventId, staffSession.user.id, values);
    } else {
      await updateDraftEvent(eventId, staffSession.user.id, values);
    }
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
    if (
      error instanceof PublishedEventChangeError ||
      error instanceof EventCapacityConflictError
    ) {
      return {
        status: "error",
        message: error.message,
        values,
      };
    }

    return {
      status: "error",
      message: "The Event could not be saved. It may no longer be editable.",
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

  let publishedEvent;
  try {
    publishedEvent = await publishEvent(eventId, staffSession.user.id);
  } catch (error) {
    if (error instanceof EventSuspendedError) {
      redirect(`/events/${eventId}?error=unavailable`);
    }
    throw error;
  }
  revalidatePath("/events");
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/e/${publishedEvent.slug}`);
  redirect(`/events/${eventId}`);
}

export async function deleteEventAction(eventId: string) {
  const staffSession = await getActiveStaffSession();
  if (!staffSession) redirect("/sign-in");

  try {
    await deleteDraftEvent(eventId, staffSession.user.id);
  } catch (error) {
    if (error instanceof EventSuspendedError) {
      redirect(`/events/${eventId}?error=unavailable`);
    }
    throw error;
  }
  revalidatePath("/events");
  redirect("/events");
}

export async function returnEventToDraftAction(eventId: string) {
  const staffSession = await getActiveStaffSession();
  if (!staffSession) redirect("/sign-in");

  let draftEvent;
  try {
    draftEvent = await returnEventToDraft(eventId, staffSession.user.id);
  } catch (error) {
    if (error instanceof EventSuspendedError) {
      redirect(`/events/${eventId}?error=unavailable`);
    }
    throw error;
  }
  revalidatePath("/events");
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/e/${draftEvent.slug}`);
  redirect(`/events/${eventId}`);
}

export async function cancelEventAction(eventId: string, formData: FormData) {
  const staffSession = await getActiveStaffSession();
  if (!staffSession) redirect("/sign-in");

  try {
    await cancelPublishedEvent(eventId, staffSession.user.id, {
      reason: formData.get("reason"),
    });
  } catch (error) {
    if (error instanceof EventSuspendedError) {
      redirect(`/events/${eventId}?error=unavailable`);
    }
    throw error;
  }
  revalidatePath("/events");
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/e/[slug]", "page");
  redirect(`/events/${eventId}`);
}
