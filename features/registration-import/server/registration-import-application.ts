import { createHash, randomBytes, randomUUID, type KeyObject } from "node:crypto";

import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  sql,
} from "drizzle-orm";
import { z } from "zod";

import {
  admissionOffer,
  auditEntry,
  capacityHold,
  checkIn,
  event,
  eventStaff,
  registration,
  registrationAnswer,
  registrationField,
  registrationFieldChoice,
  registrationImport,
  ticket,
} from "../../../lib/db/schema";
import {
  validateRegistrationSubmission,
  type PublicRegistrationField,
  type ValidatedRegistrationSubmission,
} from "../../registration/registration-submission";
import { createTicketCode as createRandomTicketCode } from "../../tickets/ticket-code";
import { signTicket } from "../../tickets/ticket-crypto";

import { encodeCsv, parseBoundedCsv } from "../csv";

type RegistrationImportDatabase = typeof import("../../../lib/db").db;
type SigningKey = { id: string; privateKey: KeyObject };

type ImportDependencies = {
  database: RegistrationImportDatabase;
  getSigningKey: () => SigningKey;
  now?: () => Date;
  createTicketCode?: () => string;
  createTicketId?: () => string;
  createManagementToken?: () => string;
};

const answerSchema = z.union([
  z.string(),
  z.array(z.string()),
  z.boolean(),
  z.null(),
]);
const previewPayloadSchema = z.object({
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

export type RegistrationImportPreview = z.infer<typeof previewPayloadSchema> & {
  id: string;
  expiresAt: Date;
  canConfirm: boolean;
};

export type ConfirmImportResult =
  | { outcome: "completed"; importedCount: number; alreadyCompleted: boolean }
  | { outcome: "invalid" | "expired" | "stale" | "forbidden" };

export type RegistrationExport = {
  eventName: string;
  fileName: string;
  csv: string;
};

function normalizedHeader(value: string) {
  return value.trim().toLocaleLowerCase();
}

function digestToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function answerFromCell(field: PublicRegistrationField, value: string) {
  if (field.answerType === "multiple_choice") {
    const byName = new Map(
      field.choices.flatMap((choice) => [
        [choice.id.toLocaleLowerCase(), choice.id] as const,
        [choice.label.toLocaleLowerCase(), choice.id] as const,
      ]),
    );
    return value
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => byName.get(item.toLocaleLowerCase()) ?? item);
  }
  if (field.answerType === "single_choice") {
    const match = field.choices.find(
      (choice) =>
        choice.id.toLocaleLowerCase() === value.trim().toLocaleLowerCase() ||
        choice.label.toLocaleLowerCase() === value.trim().toLocaleLowerCase(),
    );
    return match?.id ?? value.trim();
  }
  if (field.answerType === "acknowledgment") {
    return /^(1|true|yes|y|on)$/i.test(value.trim());
  }
  return value;
}

async function getFields(
  database: Pick<RegistrationImportDatabase, "select">,
  eventId: string,
  options: { includeArchived?: boolean } = {},
) {
  const fieldRows = await database
    .select({
      id: registrationField.id,
      answerType: registrationField.answerType,
      label: registrationField.label,
      helpText: registrationField.helpText,
      required: registrationField.required,
    })
    .from(registrationField)
    .where(
      options.includeArchived
        ? eq(registrationField.eventId, eventId)
        : and(
            eq(registrationField.eventId, eventId),
            eq(registrationField.archived, false),
          ),
    )
    .orderBy(asc(registrationField.position), asc(registrationField.id));
  const choiceRows =
    fieldRows.length === 0
      ? []
      : await database
          .select({
            id: registrationFieldChoice.id,
            fieldId: registrationFieldChoice.fieldId,
            label: registrationFieldChoice.label,
          })
          .from(registrationFieldChoice)
          .where(
            options.includeArchived
              ? inArray(
                  registrationFieldChoice.fieldId,
                  fieldRows.map(({ id }) => id),
                )
              : and(
                  inArray(
                    registrationFieldChoice.fieldId,
                    fieldRows.map(({ id }) => id),
                  ),
                  eq(registrationFieldChoice.archived, false),
                ),
          )
          .orderBy(
            asc(registrationFieldChoice.position),
            asc(registrationFieldChoice.id),
          );
  const choicesByField = new Map<string, Array<{ id: string; label: string }>>();
  for (const choice of choiceRows) {
    const choices = choicesByField.get(choice.fieldId) ?? [];
    choices.push({ id: choice.id, label: choice.label });
    choicesByField.set(choice.fieldId, choices);
  }
  return fieldRows.map(
    (field): PublicRegistrationField => ({
      ...field,
      answerType: field.answerType as PublicRegistrationField["answerType"],
      choices: choicesByField.get(field.id) ?? [],
    }),
  );
}

async function getCapacityUsage(
  database: Pick<RegistrationImportDatabase, "select">,
  eventId: string,
  at: Date,
) {
  const [usage] = await database
    .select({
      confirmed: sql<number>`(
        select count(*)::int from ${registration} as confirmed_registration
        where confirmed_registration.event_id = ${eventId}
          and confirmed_registration.status = 'confirmed'
      )`,
      holds: sql<number>`(
        select count(*)::int from ${capacityHold} as active_hold
        inner join ${registration} as held_registration
          on held_registration.id = active_hold.registration_id
        where held_registration.event_id = ${eventId}
          and active_hold.claimed_at is null
          and active_hold.expires_at > ${at}
      )`,
      offers: sql<number>`(
        select count(*)::int from ${admissionOffer} as active_offer
        inner join ${registration} as offered_registration
          on offered_registration.id = active_offer.registration_id
        where offered_registration.event_id = ${eventId}
          and active_offer.status = 'active'
          and active_offer.expires_at > ${at}
      )`,
    })
    .from(event)
    .where(eq(event.id, eventId))
    .limit(1);
  return (usage?.confirmed ?? 0) + (usage?.holds ?? 0) + (usage?.offers ?? 0);
}

function mapHeaders(headers: string[], fields: PublicRegistrationField[]) {
  const fieldByHeader = new Map<string, PublicRegistrationField>();
  for (const field of fields) {
    fieldByHeader.set(field.id.toLocaleLowerCase(), field);
    const labelKey = normalizedHeader(field.label);
    if (!fieldByHeader.has(labelKey)) fieldByHeader.set(labelKey, field);
  }

  return headers.map((header) => {
    const key = normalizedHeader(header);
    if (key === "name")
      return { header, kind: "name" as const, label: "Name" };
    if (key === "email")
      return { header, kind: "email" as const, label: "Email" };
    const field = fieldByHeader.get(key);
    return field
      ? {
          header,
          kind: "field" as const,
          fieldId: field.id,
          label: field.label,
        }
      : null;
  });
}

export function createRegistrationImportService({
  database,
  getSigningKey,
  now = () => new Date(),
  createTicketCode = createRandomTicketCode,
  createTicketId = randomUUID,
  createManagementToken = () => randomBytes(32).toString("base64url"),
}: ImportDependencies) {
  async function previewImport(
    eventId: string,
    actorUserId: string,
    csv: string,
  ): Promise<RegistrationImportPreview | null> {
    const previewedAt = now();
    const [authorizedEvent] = await database
      .select({ id: event.id, capacity: event.capacity, status: event.status })
      .from(eventStaff)
      .innerJoin(event, eq(event.id, eventStaff.eventId))
      .where(
        and(
          eq(event.id, eventId),
          eq(eventStaff.userId, actorUserId),
          inArray(eventStaff.role, ["owner", "organizer"]),
        ),
      )
      .limit(1);
    if (!authorizedEvent || authorizedEvent.status === "canceled") return null;

    const parsed = parseBoundedCsv(csv);
    const fields = await getFields(database, eventId);
    const mapped = mapHeaders(parsed.headers, fields);
    const mappings = mapped.filter(
      (mapping): mapping is NonNullable<(typeof mapped)[number]> =>
        mapping !== null,
    );
    const mappingErrors: string[] = [];
    if (!mappings.some(({ kind }) => kind === "name")) {
      mappingErrors.push('Map a "name" column.');
    }
    if (!mappings.some(({ kind }) => kind === "email")) {
      mappingErrors.push('Map an "email" column.');
    }
    const mappedFieldIds = mappings.flatMap((mapping) =>
      mapping.kind === "field" && mapping.fieldId ? [mapping.fieldId] : [],
    );
    if (new Set(mappedFieldIds).size !== mappedFieldIds.length) {
      mappingErrors.push("A Registration Field is mapped more than once.");
    }
    for (const header of mapped) {
      if (!header) mappingErrors.push("One or more headers could not be mapped.");
    }

    const fieldsById = new Map(fields.map((field) => [field.id, field]));
    const rows: z.infer<typeof previewPayloadSchema>["rows"] = [];
    for (const sourceRow of parsed.rows) {
      let name = "";
      let email = "";
      const answers: Record<string, unknown> = {};
      mapped.forEach((mapping, index) => {
        if (!mapping) return;
        const value = sourceRow.values[index] ?? "";
        if (mapping.kind === "name") name = value;
        else if (mapping.kind === "email") email = value;
        else if (mapping.fieldId) {
          const field = fieldsById.get(mapping.fieldId);
          if (field) answers[field.id] = answerFromCell(field, value);
        }
      });
      const validation = validateRegistrationSubmission(
        { name, email, answers },
        fields,
      );
      const errors = [...mappingErrors];
      let data: ValidatedRegistrationSubmission | null = null;
      if (validation.success) data = validation.data;
      else {
        errors.push(
          ...Object.values(validation.fieldErrors)
            .flat()
            .map((message) => message),
        );
      }
      rows.push({
        rowNumber: sourceRow.rowNumber,
        name: data?.name ?? name.trim(),
        email: data?.email ?? email.trim(),
        normalizedEmail: data?.normalizedEmail ?? email.trim().toLowerCase(),
        answers: data?.answers ?? null,
        errors,
      });
    }

    const emailCounts = new Map<string, number>();
    for (const row of rows) {
      if (row.normalizedEmail) {
        emailCounts.set(
          row.normalizedEmail,
          (emailCounts.get(row.normalizedEmail) ?? 0) + 1,
        );
      }
    }
    for (const row of rows) {
      if ((emailCounts.get(row.normalizedEmail) ?? 0) > 1) {
        row.errors.push("Duplicate email address in this CSV.");
      }
    }

    const normalizedEmails = [...emailCounts.keys()];
    const existing =
      normalizedEmails.length === 0
        ? []
        : await database
            .select({ normalizedEmail: registration.normalizedEmail })
            .from(registration)
            .where(
              and(
                eq(registration.eventId, eventId),
                inArray(registration.normalizedEmail, normalizedEmails),
                inArray(registration.status, [
                  "unconfirmed",
                  "confirmed",
                  "waitlisted",
                ]),
              ),
            );
    const existingEmails = new Set(existing.map((row) => row.normalizedEmail));
    for (const row of rows) {
      if (existingEmails.has(row.normalizedEmail)) {
        row.errors.push("An active Registration already uses this email address.");
      }
    }

    const claimed = await getCapacityUsage(database, eventId, previewedAt);
    const validRows = rows.filter((row) => row.errors.length === 0);
    const remaining = Math.max(0, authorizedEvent.capacity - claimed);
    if (validRows.length > remaining) {
      for (const row of validRows.slice(remaining)) {
        row.errors.push("This row would exceed Event Capacity.");
      }
    }
    const payload = previewPayloadSchema.parse({
      mappings,
      rows,
      projectedCapacity: {
        capacity: authorizedEvent.capacity,
        claimed,
        imported: rows.filter((row) => row.errors.length === 0).length,
        remaining: Math.max(
          0,
          authorizedEvent.capacity -
            claimed -
            rows.filter((row) => row.errors.length === 0).length,
        ),
      },
    });
    const expiresAt = new Date(previewedAt.getTime() + 30 * 60_000);
    const [created] = await database
      .insert(registrationImport)
      .values({
        eventId,
        actorUserId,
        payload,
        rowCount: rows.length,
        expiresAt,
      })
      .returning({ id: registrationImport.id });
    if (!created) throw new Error("Could not save the import preview.");
    return {
      id: created.id,
      expiresAt,
      ...payload,
      canConfirm: payload.rows.every((row) => row.errors.length === 0),
    };
  }

  async function confirmImport(
    eventId: string,
    actorUserId: string,
    importId: string,
  ): Promise<ConfirmImportResult> {
    const confirmedAt = now();
    return database.transaction(async (transaction) => {
      const [authorizedEvent] = await transaction
        .select({ id: event.id, capacity: event.capacity, status: event.status })
        .from(eventStaff)
        .innerJoin(event, eq(event.id, eventStaff.eventId))
        .where(
          and(
            eq(event.id, eventId),
            eq(eventStaff.userId, actorUserId),
            inArray(eventStaff.role, ["owner", "organizer"]),
          ),
        )
        .for("update")
        .limit(1);
      if (!authorizedEvent || authorizedEvent.status === "canceled") {
        return { outcome: "forbidden" } as const;
      }
      const [stored] = await transaction
        .select()
        .from(registrationImport)
        .where(
          and(
            eq(registrationImport.id, importId),
            eq(registrationImport.eventId, eventId),
            eq(registrationImport.actorUserId, actorUserId),
          ),
        )
        .for("update")
        .limit(1);
      if (!stored) return { outcome: "invalid" } as const;
      if (stored.status === "completed") {
        return {
          outcome: "completed",
          importedCount: stored.importedCount ?? 0,
          alreadyCompleted: true,
        } as const;
      }
      if (stored.expiresAt <= confirmedAt) return { outcome: "expired" } as const;
      const parsedPayload = previewPayloadSchema.safeParse(stored.payload);
      if (
        !parsedPayload.success ||
        parsedPayload.data.rows.some(
          (row) => row.errors.length > 0 || row.answers === null,
        )
      ) {
        return { outcome: "invalid" } as const;
      }

      const payload = parsedPayload.data;
      const normalizedEmails = payload.rows.map((row) => row.normalizedEmail);
      const existing = await transaction
        .select({ id: registration.id })
        .from(registration)
        .where(
          and(
            eq(registration.eventId, eventId),
            inArray(registration.normalizedEmail, normalizedEmails),
            inArray(registration.status, [
              "unconfirmed",
              "confirmed",
              "waitlisted",
            ]),
          ),
        )
        .limit(1);
      const claimed = await getCapacityUsage(transaction, eventId, confirmedAt);
      if (
        existing.length > 0 ||
        claimed + payload.rows.length > authorizedEvent.capacity
      ) {
        return { outcome: "stale" } as const;
      }
      const signingKey = getSigningKey();

      const insertedRegistrations = await transaction
        .insert(registration)
        .values(
          payload.rows.map((row) => ({
            eventId,
            attendeeName: row.name,
            email: row.email,
            normalizedEmail: row.normalizedEmail,
            status: "confirmed",
            capacityOutcome: "capacity_hold",
            source: "imported",
            verifiedAt: confirmedAt,
            managementTokenDigest: digestToken(createManagementToken()),
          })),
        )
        .returning({ id: registration.id });
      if (insertedRegistrations.length !== payload.rows.length) {
        throw new Error("Could not import Registration.");
      }
      const createdRegistrations = payload.rows.map((row, index) => {
        const createdRegistration = insertedRegistrations[index];
        if (!createdRegistration) throw new Error("Could not import Registration.");
        return {
          registrationId: createdRegistration.id,
          row,
        };
      });

      const existingTicketCodes = await transaction
        .select({ code: ticket.code })
        .from(ticket)
        .where(eq(ticket.eventId, eventId));
      const usedCodes = new Set(existingTicketCodes.map(({ code }) => code));
      const ticketRows = createdRegistrations.map(({ registrationId }) => {
        let code: string | null = null;
        for (let attempt = 0; attempt < 20; attempt += 1) {
          const candidate = createTicketCode();
          if (usedCodes.has(candidate)) continue;
          code = candidate;
          usedCodes.add(candidate);
          break;
        }
        if (!code) throw new Error("Could not allocate a unique Ticket Code.");
        const ticketId = createTicketId();
        return {
          id: ticketId,
          eventId,
          registrationId,
          code,
          signedPayload: signTicket({ eventId, ticketId }, signingKey),
          signingKeyId: signingKey.id,
        };
      });
      await transaction.insert(ticket).values(ticketRows);

      const fieldIds = payload.mappings.flatMap((mapping) =>
        mapping.kind === "field" && mapping.fieldId ? [mapping.fieldId] : [],
      );
      if (fieldIds.length > 0) {
        await transaction.insert(registrationAnswer).values(
          createdRegistrations.flatMap(({ registrationId, row }) =>
            fieldIds.map((fieldId) => ({
              registrationId,
              fieldId,
              value: row.answers![fieldId] ?? null,
            })),
          ),
        );
        await transaction
          .update(registrationField)
          .set({
            responseCount: sql`${registrationField.responseCount} + ${payload.rows.length}`,
          })
          .where(inArray(registrationField.id, fieldIds));
      }
      await transaction
        .update(registrationImport)
        .set({
          status: "completed",
          importedCount: payload.rows.length,
          completedAt: confirmedAt,
        })
        .where(eq(registrationImport.id, importId));
      await transaction.insert(auditEntry).values({
        eventId,
        actorUserId,
        action: "registration.imported",
        targetType: "registration_import",
        targetId: importId,
        metadata: {
          importedCount: payload.rows.length,
          mappedFieldCount: fieldIds.length,
        },
      });
      return {
        outcome: "completed",
        importedCount: payload.rows.length,
        alreadyCompleted: false,
      } as const;
    });
  }

  async function exportRegistrations(
    eventId: string,
    actorUserId: string,
  ): Promise<RegistrationExport | null> {
    const exportedAt = now();
    return database.transaction(async (transaction) => {
      const [authorizedEvent] = await transaction
        .select({ id: event.id, name: event.name, slug: event.slug })
        .from(eventStaff)
        .innerJoin(event, eq(event.id, eventStaff.eventId))
        .where(
          and(
            eq(event.id, eventId),
            eq(eventStaff.userId, actorUserId),
            inArray(eventStaff.role, ["owner", "organizer"]),
          ),
        )
        .limit(1);
      if (!authorizedEvent) return null;

      const registrations = await transaction
        .select({
          id: registration.id,
          name: registration.attendeeName,
          email: registration.email,
          status: registration.status,
        })
        .from(registration)
        .where(eq(registration.eventId, eventId))
        .orderBy(asc(registration.createdAt), asc(registration.id));
      const registrationIds = registrations.map(({ id }) => id);
      const ticketRows =
        registrationIds.length === 0
          ? []
          : await transaction
              .select({
                id: ticket.id,
                registrationId: ticket.registrationId,
                status: ticket.status,
              })
              .from(ticket)
              .where(inArray(ticket.registrationId, registrationIds))
              .orderBy(desc(ticket.createdAt), desc(ticket.id));
      const latestTicketByRegistration = new Map<
        string,
        (typeof ticketRows)[number]
      >();
      for (const ticketRow of ticketRows) {
        if (!latestTicketByRegistration.has(ticketRow.registrationId)) {
          latestTicketByRegistration.set(ticketRow.registrationId, ticketRow);
        }
      }
      const latestTicketIds = [...latestTicketByRegistration.values()].map(
        ({ id }) => id,
      );
      const checkInRows =
        latestTicketIds.length === 0
          ? []
          : await transaction
              .select({
                ticketId: checkIn.ticketId,
                checkedInAt: checkIn.checkedInAt,
              })
              .from(checkIn)
              .where(
                and(
                  inArray(checkIn.ticketId, latestTicketIds),
                  isNull(checkIn.invalidatedAt),
                ),
              );
      const checkInByTicket = new Map(
        checkInRows.map((row) => [row.ticketId, row.checkedInAt]),
      );

      const fields = await getFields(transaction, eventId, {
        includeArchived: true,
      });
      const answerRows =
        registrationIds.length === 0 || fields.length === 0
          ? []
          : await transaction
              .select({
                registrationId: registrationAnswer.registrationId,
                fieldId: registrationAnswer.fieldId,
                value: registrationAnswer.value,
              })
              .from(registrationAnswer)
              .where(inArray(registrationAnswer.registrationId, registrationIds));
      const answerByRegistration = new Map<string, Map<string, unknown>>();
      for (const answer of answerRows) {
        const answers =
          answerByRegistration.get(answer.registrationId) ??
          new Map<string, unknown>();
        answers.set(answer.fieldId, answer.value);
        answerByRegistration.set(answer.registrationId, answers);
      }
      const choiceLabels = new Map(
        fields.flatMap((field) =>
          field.choices.map((choice) => [choice.id, choice.label] as const),
        ),
      );
      const renderAnswer = (value: unknown) => {
        if (Array.isArray(value)) {
          return value
            .map((item) =>
              typeof item === "string" ? (choiceLabels.get(item) ?? item) : "",
            )
            .filter(Boolean)
            .join("; ");
        }
        if (typeof value === "string") return choiceLabels.get(value) ?? value;
        if (typeof value === "boolean") return value ? "Yes" : "No";
        return "";
      };
      const csv = encodeCsv([
        [
          "name",
          "email",
          "registration_status",
          "ticket_state",
          "check_in_time",
          ...fields.map((field) => `answer:${field.label}`),
        ],
        ...registrations.map((record) => {
          const latestTicket = latestTicketByRegistration.get(record.id);
          const checkedInAt = latestTicket
            ? checkInByTicket.get(latestTicket.id)
            : null;
          const answers = answerByRegistration.get(record.id);
          return [
            record.name,
            record.email,
            record.status,
            latestTicket?.status ?? "not_issued",
            checkedInAt?.toISOString() ?? "",
            ...fields.map((field) => renderAnswer(answers?.get(field.id))),
          ];
        }),
      ]);
      await transaction.insert(auditEntry).values({
        eventId,
        actorUserId,
        action: "registration.exported",
        targetType: "event",
        targetId: eventId,
        metadata: { exportedCount: registrations.length },
        createdAt: exportedAt,
      });
      return {
        eventName: authorizedEvent.name,
        fileName: `${authorizedEvent.slug}-registrations.csv`,
        csv,
      };
    });
  }

  return { previewImport, confirmImport, exportRegistrations };
}
