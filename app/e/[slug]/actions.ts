"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { submitRegistration } from "@/features/registration/server/submit-registration";

import type { RegistrationActionState } from "./form-state";

export type { RegistrationActionState };

function stringValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function submitRegistrationAction(
  slug: string,
  fieldIds: string[],
  _previousState: RegistrationActionState,
  formData: FormData,
): Promise<RegistrationActionState> {
  if (stringValue(formData, "website").trim()) {
    redirect(`/e/${slug}/check-email?outcome=neutral`);
  }

  const answers = Object.fromEntries(
    fieldIds.map((fieldId) => {
      const values = formData
        .getAll(`answer.${fieldId}`)
        .filter((value): value is string => typeof value === "string");
      return [fieldId, values.length > 1 ? values : (values[0] ?? "")];
    }),
  );
  const values = {
    name: stringValue(formData, "name"),
    email: stringValue(formData, "email"),
    answers,
  };

  let result;
  try {
    result = await submitRegistration(slug, values, await headers());
  } catch {
    return {
      status: "error",
      message: "Your Registration could not be submitted. Try again.",
      values,
    };
  }

  if (result.outcome === "invalid") {
    return {
      status: "error",
      message: "Review the highlighted fields and try again.",
      fieldErrors: result.fieldErrors,
      values: result.values,
    };
  }
  if (result.outcome === "existing_registration") {
    redirect(`/e/${slug}/check-email?outcome=neutral`);
  }
  if (result.outcome === "rate_limited") {
    return {
      status: "error",
      message: "Your Registration could not be submitted right now. Try again later.",
      values,
    };
  }
  if (result.outcome === "registration_closed") {
    return {
      status: "error",
      message: "Registration is not currently open for this Event.",
      values,
    };
  }
  if (result.outcome === "event_unavailable") {
    return {
      status: "error",
      message: "This Event is currently unavailable.",
      values,
    };
  }

  redirect(`/e/${slug}/check-email?outcome=neutral`);
}
