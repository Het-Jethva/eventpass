import { describe, expect, it } from "vitest";

import { validateRegistrationSubmission } from "./registration-submission";

const shortTextFieldId = "9e1e6704-6818-4dc4-a800-1be7508db44f";
const choiceFieldId = "28acb10c-073e-477a-8367-adfc14f73c61";
const firstChoiceId = "033f01e5-daf9-419f-8a76-af68ed4b55bf";
const secondChoiceId = "cba43416-c2d5-4ba4-af74-bd19f421dd28";

describe("Registration submission", () => {
  it("validates every active Registration Field and returns the correct input with errors", () => {
    const result = validateRegistrationSubmission(
      {
        name: "  Ada Lovelace  ",
        email: " ADA@Example.com ",
        answers: {
          [shortTextFieldId]: "Compiler pioneer",
          [choiceFieldId]: "not-a-choice",
        },
      },
      [
        {
          id: shortTextFieldId,
          answerType: "short_text",
          label: "Biography",
          helpText: null,
          required: true,
          choices: [],
        },
        {
          id: choiceFieldId,
          answerType: "single_choice",
          label: "Meal",
          helpText: null,
          required: true,
          choices: [
            { id: firstChoiceId, label: "Vegetarian" },
            { id: secondChoiceId, label: "Vegan" },
          ],
        },
      ],
    );

    expect(result).toEqual({
      success: false,
      fieldErrors: {
        [`answer.${choiceFieldId}`]: ["Choose an available option."],
      },
      values: {
        name: "  Ada Lovelace  ",
        email: " ADA@Example.com ",
        answers: {
          [shortTextFieldId]: "Compiler pioneer",
          [choiceFieldId]: "not-a-choice",
        },
      },
    });
  });
});
