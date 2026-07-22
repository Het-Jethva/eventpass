import "server-only";

import { and, asc, eq, inArray, ne, notInArray } from "drizzle-orm";

import {
  assertRegistrationFormUpdate,
  RegistrationFormDefinitionInvariantError as RegistrationFormInvariantError,
  registrationFormDefinitionSchema,
  type RegistrationFieldDefinition,
} from "@/features/registration/registration-form-schema";
import { db } from "@/lib/db";
import {
  event,
  eventStaff,
  registrationField,
  registrationFieldChoice,
} from "@/lib/db/schema";

export type OrganizerRegistrationField = RegistrationFieldDefinition & {
  responseCount: number;
};

export class RegistrationFormNotEditableError extends Error {}
export { RegistrationFormInvariantError };

async function authorizeOrganizer(
  database: Pick<typeof db, "select">,
  eventId: string,
  actorUserId: string,
) {
  const [authorization] = await database
    .select({ id: event.id })
    .from(eventStaff)
    .innerJoin(event, eq(event.id, eventStaff.eventId))
    .where(
      and(
        eq(event.id, eventId),
        ne(event.status, "canceled"),
        eq(eventStaff.userId, actorUserId),
        inArray(eventStaff.role, ["owner", "organizer"]),
      ),
    )
    .limit(1);

  if (!authorization) {
    throw new RegistrationFormNotEditableError(
      "Only an Organizer can configure this Event's Registration form.",
    );
  }
}

export async function getOrganizerRegistrationForm(
  eventId: string,
  actorUserId: string,
): Promise<OrganizerRegistrationField[]> {
  await authorizeOrganizer(db, eventId, actorUserId);

  const fields = await db
    .select({
      id: registrationField.id,
      answerType: registrationField.answerType,
      label: registrationField.label,
      helpText: registrationField.helpText,
      required: registrationField.required,
      archived: registrationField.archived,
      responseCount: registrationField.responseCount,
    })
    .from(registrationField)
    .where(eq(registrationField.eventId, eventId))
    .orderBy(asc(registrationField.position), asc(registrationField.id));

  if (fields.length === 0) return [];

  const choices = await db
    .select({
      id: registrationFieldChoice.id,
      fieldId: registrationFieldChoice.fieldId,
      label: registrationFieldChoice.label,
      archived: registrationFieldChoice.archived,
    })
    .from(registrationFieldChoice)
    .where(inArray(registrationFieldChoice.fieldId, fields.map((field) => field.id)))
    .orderBy(
      asc(registrationFieldChoice.position),
      asc(registrationFieldChoice.id),
    );

  const choicesByField = new Map<string, RegistrationFieldDefinition["choices"]>();
  for (const choice of choices) {
    const fieldChoices = choicesByField.get(choice.fieldId) ?? [];
    fieldChoices.push({
      id: choice.id,
      label: choice.label,
      archived: choice.archived,
    });
    choicesByField.set(choice.fieldId, fieldChoices);
  }

  return fields.map((field) => ({
    ...field,
    answerType: field.answerType as OrganizerRegistrationField["answerType"],
    helpText: field.helpText ?? "",
    choices: choicesByField.get(field.id) ?? [],
  }));
}

export async function saveRegistrationForm(
  eventId: string,
  actorUserId: string,
  rawDefinition: unknown,
) {
  const definition = registrationFormDefinitionSchema.parse(rawDefinition);

  return db.transaction(async (transaction) => {
    await authorizeOrganizer(transaction, eventId, actorUserId);

    const existingFields = await transaction
      .select({
        id: registrationField.id,
        answerType: registrationField.answerType,
        responseCount: registrationField.responseCount,
      })
      .from(registrationField)
      .where(eq(registrationField.eventId, eventId));
    const existingById = new Map(existingFields.map((field) => [field.id, field]));

    const incomingFieldIds = definition.map((field) => field.id);
    if (incomingFieldIds.length > 0) {
      const identityCollisions = await transaction
        .select({ id: registrationField.id, eventId: registrationField.eventId })
        .from(registrationField)
        .where(inArray(registrationField.id, incomingFieldIds));
      if (identityCollisions.some((field) => field.eventId !== eventId)) {
        throw new RegistrationFormInvariantError(
          "A Registration Field identity cannot move between Events.",
        );
      }
    }

    const existingChoices =
      existingFields.length === 0
        ? []
        : await transaction
            .select({
              id: registrationFieldChoice.id,
              fieldId: registrationFieldChoice.fieldId,
            })
            .from(registrationFieldChoice)
            .where(
              inArray(
                registrationFieldChoice.fieldId,
                existingFields.map((field) => field.id),
              ),
            );
    const existingChoicesByField = new Map<string, string[]>();
    for (const choice of existingChoices) {
      const ids = existingChoicesByField.get(choice.fieldId) ?? [];
      ids.push(choice.id);
      existingChoicesByField.set(choice.fieldId, ids);
    }

    const incomingChoiceOwners = new Map(
      definition.flatMap((field) =>
        field.choices.map((choice) => [choice.id, field.id] as const),
      ),
    );
    if (incomingChoiceOwners.size > 0) {
      const choiceIdentityCollisions = await transaction
        .select({
          id: registrationFieldChoice.id,
          fieldId: registrationFieldChoice.fieldId,
        })
        .from(registrationFieldChoice)
        .where(inArray(registrationFieldChoice.id, [...incomingChoiceOwners.keys()]));
      if (
        choiceIdentityCollisions.some(
          (choice) => incomingChoiceOwners.get(choice.id) !== choice.fieldId,
        )
      ) {
        throw new RegistrationFormInvariantError(
          "A choice identity cannot move between Registration Fields.",
        );
      }
    }

    assertRegistrationFormUpdate(
      existingFields.map((field) => ({
        ...field,
        answerType: field.answerType as OrganizerRegistrationField["answerType"],
        choiceIds: existingChoicesByField.get(field.id) ?? [],
      })),
      definition,
    );

    if (definition.length > 0) {
      const newFields = definition.flatMap((field, position) =>
        existingById.has(field.id)
          ? []
          : [{
            id: field.id,
            eventId,
            answerType: field.answerType,
            label: field.label,
            helpText: field.helpText || null,
            required: field.required,
            archived: field.archived,
            position,
          }],
      );
      if (newFields.length > 0) {
        await transaction.insert(registrationField).values(newFields);
      }

      for (const [position, field] of definition.entries()) {
        const existing = existingById.get(field.id);
        await transaction
          .update(registrationField)
          .set({
            answerType: field.answerType,
            label: field.label,
            helpText: field.helpText || null,
            required: field.required,
            archived: field.archived,
            position,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(registrationField.id, field.id),
              eq(registrationField.eventId, eventId),
            ),
          );

        if (field.choices.length > 0) {
          await transaction
            .insert(registrationFieldChoice)
            .values(
              field.choices.map((choice, choicePosition) => ({
                id: choice.id,
                fieldId: field.id,
                label: choice.label,
                archived: choice.archived,
                position: choicePosition,
              })),
            )
            .onConflictDoNothing({ target: registrationFieldChoice.id });

          for (const [choicePosition, choice] of field.choices.entries()) {
            await transaction
              .update(registrationFieldChoice)
              .set({
                label: choice.label,
                archived: choice.archived,
                position: choicePosition,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(registrationFieldChoice.id, choice.id),
                  eq(registrationFieldChoice.fieldId, field.id),
                ),
              );
          }
        }

        const incomingChoiceIds = field.choices.map((choice) => choice.id);
        if (existing?.responseCount === 0) {
          await transaction
            .delete(registrationFieldChoice)
            .where(
              incomingChoiceIds.length === 0
                ? eq(registrationFieldChoice.fieldId, field.id)
                : and(
                    eq(registrationFieldChoice.fieldId, field.id),
                    notInArray(registrationFieldChoice.id, incomingChoiceIds),
                  ),
            );
        }
      }
    }

    const removedFields = existingFields.filter(
      (field) => !incomingFieldIds.includes(field.id),
    );
    if (removedFields.length > 0) {
      const removedIds = removedFields.map((field) => field.id);
      await transaction
        .delete(registrationFieldChoice)
        .where(inArray(registrationFieldChoice.fieldId, removedIds));
      await transaction
        .delete(registrationField)
        .where(
          and(
            eq(registrationField.eventId, eventId),
            inArray(registrationField.id, removedIds),
          ),
        );
    }
  });
}
