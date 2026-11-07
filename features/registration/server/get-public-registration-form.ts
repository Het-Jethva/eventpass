import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import { parseRegistrationFieldAnswerType } from "@/features/registration/registration-form-schema";
import type { PublicRegistrationField } from "@/features/registration/registration-submission";
import { db, type DatabaseClient } from "@/lib/db";
import { registrationField, registrationFieldChoice } from "@/lib/db/schema";

type FormReader = Pick<DatabaseClient, "select">;

export function getPublicRegistrationForm(
  eventId: string,
  reader: FormReader = db,
) {
  return readRegistrationForm(eventId, reader, false);
}

export function getHistoricalRegistrationForm(
  eventId: string,
  reader: FormReader = db,
) {
  return readRegistrationForm(eventId, reader, true);
}

async function readRegistrationForm(
  eventId: string,
  reader: FormReader,
  includeArchived: boolean,
) {
  const fields = await reader
    .select({
      id: registrationField.id,
      answerType: registrationField.answerType,
      label: registrationField.label,
      helpText: registrationField.helpText,
      required: registrationField.required,
    })
    .from(registrationField)
    .where(
      includeArchived
        ? eq(registrationField.eventId, eventId)
        : and(
            eq(registrationField.eventId, eventId),
            eq(registrationField.archived, false),
          ),
    )
    .orderBy(asc(registrationField.position), asc(registrationField.id));

  const choices =
    fields.length === 0
      ? []
      : await reader
          .select({
            id: registrationFieldChoice.id,
            fieldId: registrationFieldChoice.fieldId,
            label: registrationFieldChoice.label,
          })
          .from(registrationFieldChoice)
          .where(
            includeArchived
              ? inArray(
                  registrationFieldChoice.fieldId,
                  fields.map(({ id }) => id),
                )
              : and(
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

  const choicesByField = new Map<string, PublicRegistrationField["choices"]>();
  for (const choice of choices) {
    const fieldChoices = choicesByField.get(choice.fieldId) ?? [];
    fieldChoices.push({ id: choice.id, label: choice.label });
    choicesByField.set(choice.fieldId, fieldChoices);
  }

  return fields.map((field) => ({
    ...field,
    answerType: parseRegistrationFieldAnswerType(field.answerType),
    choices: choicesByField.get(field.id) ?? [],
  })) satisfies PublicRegistrationField[];
}
