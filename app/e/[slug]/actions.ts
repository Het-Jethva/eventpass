"use server";

import { redirect } from "next/navigation";

import type { RegistrationSubmissionValues } from "@/features/registration/registration-submission";
import { submitRegistration } from "@/features/registration/server/submit-registration";

export type RegistrationActionState = {
  status: "idle" | "error" | "existing";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  values?: RegistrationSubmissionValues;
};

export const initialRegistrationActionState: RegistrationActionState = {
  status: "idle",
};

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
    result = await submitRegistration(slug, values);
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
    return {
      status: "existing",
      message:
        "An active Registration already exists for this email address and Event.",
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

  const destination = new URLSearchParams({
    outcome: result.outcome === "capacity_hold" ? "hold" : "waitlist",
  });
  if (result.deliveryStatus === "failed") destination.set("delivery", "failed");
  redirect(`/e/${slug}/check-email?${destination.toString()}`);
}
