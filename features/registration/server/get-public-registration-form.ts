import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import type { PublicRegistrationField } from "@/features/registration/registration-submission";
import { db } from "@/lib/db";
import { registrationField, registrationFieldChoice } from "@/lib/db/schema";

export async function getPublicRegistrationForm(eventId: string) {
  const fields = await db
    .select({
      id: registrationField.id,
      answerType: registrationField.answerType,
      label: registrationField.label,
      helpText: registrationField.helpText,
      required: registrationField.required,
    })
    .from(registrationField)
    .where(
      and(
        eq(registrationField.eventId, eventId),
        eq(registrationField.archived, false),
      ),
    )
    .orderBy(asc(registrationField.position), asc(registrationField.id));

  const choices =
    fields.length === 0
      ? []
      : await db
          .select({
            id: registrationFieldChoice.id,
            fieldId: registrationFieldChoice.fieldId,
            label: registrationFieldChoice.label,
          })
          .from(registrationFieldChoice)
          .where(
            and(
              inArray(
                registrationFieldChoice.fieldId,
                fields.map(({ id }) => id),
              ),
              eq(registrationFieldChoice.archived, false),
            ),
          )
          .orderBy(
            asc(registrationFieldChoice.position),
            asc(registrationFieldChoice.id),
          );

  const choicesByField = new Map<
    string,
    PublicRegistrationField["choices"]
  >();
  for (const choice of choices) {
    const fieldChoices = choicesByField.get(choice.fieldId) ?? [];
    fieldChoices.push({ id: choice.id, label: choice.label });
    choicesByField.set(choice.fieldId, fieldChoices);
  }

  return fields.map((field) => ({
    ...field,
    answerType: field.answerType as PublicRegistrationField["answerType"],
    choices: choicesByField.get(field.id) ?? [],
  })) satisfies PublicRegistrationField[];
}
