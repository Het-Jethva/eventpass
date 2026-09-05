import { describe, expect, it } from "vitest";

import {
  assertRegistrationFormUpdate,
  registrationFormDefinitionSchema,
  type RegistrationFieldDefinition,
} from "./registration-form-schema";

const fieldId = "9e1e6704-6818-4dc4-a800-1be7508db44f";
const choiceOneId = "033f01e5-daf9-419f-8a76-af68ed4b55bf";
const choiceTwoId = "cba43416-c2d5-4ba4-af74-bd19f421dd28";

function field(
  overrides: Partial<RegistrationFieldDefinition> = {},
): RegistrationFieldDefinition {
  return {
    id: fieldId,
    answerType: "single_choice",
    label: "Dietary preference",
    helpText: "Choose the closest option.",
    required: false,
    archived: false,
    choices: [
      { id: choiceOneId, label: "Vegetarian", archived: false },
      { id: choiceTwoId, label: "No preference", archived: false },
    ],
    ...overrides,
  };
}

describe("registration form definitions", () => {
  it("requires two active choices for an active choice field", () => {
    const result = registrationFormDefinitionSchema.safeParse([
      field({ choices: [{ id: choiceOneId, label: "Vegetarian", archived: false }] }),
    ]);

    expect(result.success).toBe(false);
  });

  it("keeps an answered field's identity, answer type, and choice identities stable", () => {
    const existing = [
      {
        id: fieldId,
        answerType: "single_choice" as const,
        responseCount: 3,
        choiceIds: [choiceOneId, choiceTwoId],
      },
    ];

    expect(() =>
      assertRegistrationFormUpdate(existing, [field({ answerType: "short_text", choices: [] })]),
    ).toThrow(/answer type cannot change/i);
    expect(() =>
      assertRegistrationFormUpdate(existing, [
        field({ choices: [{ id: choiceOneId, label: "Vegetarian", archived: false }] }),
      ]),
    ).toThrow(/choices used by answers/i);
    expect(() => assertRegistrationFormUpdate(existing, [])).toThrow(/must be archived/i);
  });

  it("allows relabeling and archiving while requiring new fields to be optional", () => {
    const existing = [
      {
        id: fieldId,
        answerType: "single_choice" as const,
        responseCount: 1,
        choiceIds: [choiceOneId, choiceTwoId],
      },
    ];
    const archived = field({
      label: "Updated dietary preference",
      helpText: "Updated help",
      archived: true,
    });
    const newRequired = field({
      id: "28acb10c-073e-477a-8367-adfc14f73c61",
      answerType: "short_text",
      label: "New question",
      required: true,
      choices: [],
    });

    expect(() => assertRegistrationFormUpdate(existing, [archived])).not.toThrow();
    expect(() => assertRegistrationFormUpdate(existing, [archived, newRequired])).toThrow(
      /must be optional/i,
    );
  });
});
