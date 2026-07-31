"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createDraftEvent,
  createDraftEventInputSchema,
} from "@/features/events/server/create-draft-event";
import { getActiveStaffSession } from "@/lib/staff-session";

import type {
  CreateEventFormField,
  CreateEventFormState,
} from "./form-state";

export type { CreateEventFormField, CreateEventFormState };

function formValue(formData: FormData, name: CreateEventFormField) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function createEventAction(
  _previousState: CreateEventFormState,
  formData: FormData,
): Promise<CreateEventFormState> {
  const staffSession = await getActiveStaffSession();

  if (!staffSession) {
    redirect("/sign-in");
  }

  const values = {
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
    registrationOpensAtLocal: formValue(
      formData,
      "registrationOpensAtLocal",
    ),
    registrationClosesAtLocal: formValue(
      formData,
      "registrationClosesAtLocal",
    ),
    checkInOpensAtLocal: formValue(formData, "checkInOpensAtLocal"),
    checkInClosesAtLocal: formValue(formData, "checkInClosesAtLocal"),
  } satisfies Record<CreateEventFormField, string>;
  const validation = createDraftEventInputSchema.safeParse(values);

  if (!validation.success) {
    return {
      status: "error",
      message: "Review the highlighted fields and try again.",
      fieldErrors: validation.error.flatten().fieldErrors,
      values,
    };
  }

  try {
    await createDraftEvent(staffSession.user.id, values);
  } catch {
    return {
      status: "error",
      message: "The Draft Event could not be created. Try again.",
      values,
    };
  }

  revalidatePath("/events");
  redirect("/events");
}
