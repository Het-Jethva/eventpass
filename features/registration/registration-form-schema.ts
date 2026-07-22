import { z } from "zod";

export const registrationFieldAnswerTypes = [
  "short_text",
  "long_text",
  "single_choice",
  "multiple_choice",
  "acknowledgment",
] as const;

export type RegistrationFieldAnswerType =
  (typeof registrationFieldAnswerTypes)[number];

export const registrationFieldChoiceSchema = z.object({
  id: z.uuid(),
  label: z.string().trim().min(1, "Enter a choice label.").max(200),
  archived: z.boolean(),
});

export const registrationFieldDefinitionSchema = z
  .object({
    id: z.uuid(),
    answerType: z.enum(registrationFieldAnswerTypes),
    label: z.string().trim().min(1, "Enter a field label.").max(200),
    helpText: z.string().trim().max(500),
    required: z.boolean(),
    archived: z.boolean(),
    choices: z.array(registrationFieldChoiceSchema).max(50),
  })
  .superRefine((field, context) => {
    const isChoice =
      field.answerType === "single_choice" ||
      field.answerType === "multiple_choice";
    const activeChoices = field.choices.filter((choice) => !choice.archived);

    if (isChoice && activeChoices.length < 2 && !field.archived) {
      context.addIssue({
        code: "custom",
        path: ["choices"],
        message: "Choice fields need at least two active choices.",
      });
    }

    if (!isChoice && field.choices.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["choices"],
        message: "Only choice fields can have choices.",
      });
    }

    if (new Set(field.choices.map((choice) => choice.id)).size !== field.choices.length) {
      context.addIssue({
        code: "custom",
        path: ["choices"],
        message: "Choice identities must be unique.",
      });
    }
  });

export const registrationFormDefinitionSchema = z
  .array(registrationFieldDefinitionSchema)
  .max(40, "A Registration form can have at most 40 custom fields.")
  .superRefine((fields, context) => {
    if (new Set(fields.map((field) => field.id)).size !== fields.length) {
      context.addIssue({
        code: "custom",
        message: "Registration Field identities must be unique.",
      });
    }

    const choiceIds = fields.flatMap((field) =>
      field.choices.map((choice) => choice.id),
    );
    if (new Set(choiceIds).size !== choiceIds.length) {
      context.addIssue({
        code: "custom",
        message: "Choice identities must be unique across the form.",
      });
    }
  });

export type RegistrationFieldDefinition = z.infer<
  typeof registrationFieldDefinitionSchema
>;

export type ExistingRegistrationFieldDefinition = {
  id: string;
  answerType: RegistrationFieldAnswerType;
  responseCount: number;
  choiceIds: string[];
};

export class RegistrationFormDefinitionInvariantError extends Error {}

export function assertRegistrationFormUpdate(
  existingFields: ExistingRegistrationFieldDefinition[],
  definition: RegistrationFieldDefinition[],
) {
  const existingById = new Map(existingFields.map((field) => [field.id, field]));
  const hasResponses = existingFields.some((field) => field.responseCount > 0);

  for (const existing of existingFields) {
    if (existing.responseCount === 0) continue;
    const incoming = definition.find((field) => field.id === existing.id);
    if (!incoming) {
      throw new RegistrationFormDefinitionInvariantError(
        "A Registration Field with answers must be archived, not removed.",
      );
    }
    if (incoming.answerType !== existing.answerType) {
      throw new RegistrationFormDefinitionInvariantError(
        "A Registration Field's answer type cannot change after answers exist.",
      );
    }

    const incomingChoiceIds = new Set(incoming.choices.map((choice) => choice.id));
    if (existing.choiceIds.some((choiceId) => !incomingChoiceIds.has(choiceId))) {
      throw new RegistrationFormDefinitionInvariantError(
        "Choices used by answers must be archived, not removed.",
      );
    }
  }

  if (
    hasResponses &&
    definition.some((field) => !existingById.has(field.id) && field.required)
  ) {
    throw new RegistrationFormDefinitionInvariantError(
      "Fields added after responses exist must be optional.",
    );
  }
}

export const registrationFieldAnswerTypeLabels: Record<
  RegistrationFieldAnswerType,
  string
> = {
  short_text: "Short text",
  long_text: "Long text",
  single_choice: "Single choice",
  multiple_choice: "Multiple choice",
  acknowledgment: "Acknowledgment",
};
