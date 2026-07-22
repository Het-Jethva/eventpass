import { z } from "zod";

import type { RegistrationFieldAnswerType } from "./registration-form-schema";

export type PublicRegistrationField = {
  id: string;
  answerType: RegistrationFieldAnswerType;
  label: string;
  helpText: string | null;
  required: boolean;
  choices: Array<{ id: string; label: string }>;
};

export type RegistrationSubmissionValues = {
  name: string;
  email: string;
  answers: Record<string, unknown>;
};

export type ValidatedRegistrationSubmission = {
  name: string;
  email: string;
  normalizedEmail: string;
  answers: Record<string, string | string[] | boolean | null>;
};

type RegistrationSubmissionValidation =
  | { success: true; data: ValidatedRegistrationSubmission }
  | {
      success: false;
      fieldErrors: Record<string, string[]>;
      values: RegistrationSubmissionValues;
    };

const attendeeSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(200, "Name is too long."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address.")
    .max(320, "Email address is too long."),
});

function addError(
  errors: Record<string, string[]>,
  fieldId: string,
  message: string,
) {
  errors[`answer.${fieldId}`] = [message];
}

export function validateRegistrationSubmission(
  values: RegistrationSubmissionValues,
  fields: PublicRegistrationField[],
): RegistrationSubmissionValidation {
  const errors: Record<string, string[]> = {};
  const attendee = attendeeSchema.safeParse(values);

  if (!attendee.success) {
    Object.assign(errors, attendee.error.flatten().fieldErrors);
  }

  const answers: ValidatedRegistrationSubmission["answers"] = {};
  for (const field of fields) {
    const value = values.answers[field.id];
    const availableChoices = new Set(field.choices.map((choice) => choice.id));

    if (field.answerType === "short_text" || field.answerType === "long_text") {
      const textValue = typeof value === "string" ? value.trim() : "";
      const maximum = field.answerType === "short_text" ? 500 : 4_000;
      if (field.required && !textValue) {
        addError(errors, field.id, "This field is required.");
      } else if (textValue.length > maximum) {
        addError(errors, field.id, `Keep this answer under ${maximum.toLocaleString()} characters.`);
      }
      answers[field.id] = textValue || null;
      continue;
    }

    if (field.answerType === "single_choice") {
      const choice = typeof value === "string" ? value : "";
      if (!choice && field.required) {
        addError(errors, field.id, "Choose an option.");
      } else if (choice && !availableChoices.has(choice)) {
        addError(errors, field.id, "Choose an available option.");
      }
      answers[field.id] = choice || null;
      continue;
    }

    if (field.answerType === "multiple_choice") {
      const choices = Array.isArray(value)
        ? [...new Set(value.filter((item): item is string => typeof item === "string"))]
        : typeof value === "string" && value
          ? [value]
          : [];
      if (field.required && choices.length === 0) {
        addError(errors, field.id, "Choose at least one option.");
      } else if (choices.some((choice) => !availableChoices.has(choice))) {
        addError(errors, field.id, "Choose only available options.");
      }
      answers[field.id] = choices;
      continue;
    }

    const acknowledged = value === true || value === "true" || value === "on";
    if (field.required && !acknowledged) {
      addError(errors, field.id, "Acknowledge this field to continue.");
    }
    answers[field.id] = acknowledged;
  }

  if (Object.keys(errors).length > 0 || !attendee.success) {
    return { success: false, fieldErrors: errors, values };
  }

  return {
    success: true,
    data: {
      name: attendee.data.name,
      email: attendee.data.email,
      normalizedEmail: attendee.data.email,
      answers,
    },
  };
}
