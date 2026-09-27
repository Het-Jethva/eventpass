import { z } from "zod";

const answerSchema = z.union([
  z.string(),
  z.array(z.string()),
  z.boolean(),
  z.null(),
]);

export const registrationImportPreviewPayloadSchema = z.object({
  mappings: z.array(
    z.object({
      header: z.string(),
      kind: z.enum(["name", "email", "field"]),
      fieldId: z.string().uuid().optional(),
      label: z.string(),
    }),
  ),
  rows: z.array(
    z.object({
      rowNumber: z.number().int().positive(),
      name: z.string(),
      email: z.string(),
      normalizedEmail: z.string(),
      answers: z.record(z.string(), answerSchema).nullable(),
      errors: z.array(z.string()),
    }),
  ),
  projectedCapacity: z.object({
    capacity: z.number().int(),
    claimed: z.number().int(),
    imported: z.number().int(),
    remaining: z.number().int(),
  }),
});

export const registrationImportPreviewResponseSchema =
  registrationImportPreviewPayloadSchema.extend({
    id: z.string(),
    expiresAt: z.string(),
    canConfirm: z.boolean(),
  });

export type RegistrationImportPreviewResponse = z.infer<
  typeof registrationImportPreviewResponseSchema
>;

export function parseRegistrationImportPreview(body: unknown) {
  const parsed = registrationImportPreviewResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error("The preview could not be created.");
  }
  return parsed.data;
}
