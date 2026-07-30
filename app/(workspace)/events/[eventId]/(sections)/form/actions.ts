"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  RegistrationFormInvariantError,
  RegistrationFormNotEditableError,
  saveRegistrationForm,
} from "@/features/registration/server/registration-form";
import { getActiveStaffSession } from "@/lib/staff-session";

export type SaveRegistrationFormState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialSaveRegistrationFormState: SaveRegistrationFormState = {
  status: "idle",
  message: "",
};

export async function saveRegistrationFormAction(
  eventId: string,
  _previousState: SaveRegistrationFormState,
  formData: FormData,
): Promise<SaveRegistrationFormState> {
  const staffSession = await getActiveStaffSession();
  if (!staffSession) redirect("/sign-in");

  const rawDefinition = formData.get("definition");
  if (typeof rawDefinition !== "string") {
    return { status: "error", message: "The form definition was missing." };
  }

  let definition: unknown;
  try {
    definition = JSON.parse(rawDefinition);
  } catch {
    return { status: "error", message: "The form definition was invalid." };
  }

  try {
    await saveRegistrationForm(eventId, staffSession.user.id, definition);
  } catch (error) {
    if (
      error instanceof RegistrationFormInvariantError ||
      error instanceof RegistrationFormNotEditableError
    ) {
      return { status: "error", message: error.message };
    }

    return {
      status: "error",
      message: "The Registration form could not be saved. Review each field and try again.",
    };
  }

  revalidatePath(`/events/${eventId}/form`);
  return { status: "success", message: "Registration form saved." };
}
