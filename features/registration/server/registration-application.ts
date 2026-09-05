import "server-only";

import { randomBytes } from "node:crypto";

import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

import {
  validateRegistrationSubmission,
  type PublicRegistrationField,
  type RegistrationSubmissionValues,
} from "../registration-submission";
import {
  admissionOffer,
  capacityHold,
  event,
  registration,
  registrationAnswer,
  registrationField,
  registrationFieldChoice,
  registrationVerification,
} from "../../../lib/db/schema";
import {
  reconcileWaitlistInTransaction,
  type AdmissionOfferMessage,
} from "./waitlist-reconciliation";
import { isEventSuspended } from "@/features/events/server/event-suspension";
import { deliverAdmissionOfferMessages } from "@/lib/email/deliver-admission-offers";
import { isRegistrationAttemptLimited } from "@/lib/registration-attempt-throttle";
import { digestBearerToken as digestToken } from "@/lib/bearer-token-digest";

type RegistrationDatabase = typeof import("../../../lib/db").db;

type VerificationEmail = {
  email: string;
  eventId: string;
  eventName: string;
  eventSlug: string;
  token: string;
};

type RegistrationApplicationDependencies = {
  database: RegistrationDatabase;
  sendVerificationEmail: (message: VerificationEmail) => Promise<void>;
  sendAdmissionOfferEmail?: (message: AdmissionOfferMessage) => Promise<void>;
  now?: () => Date;
  createToken?: () => string;
  createOfferToken?: () => string;
};

export type RegistrationSubmissionResult =
  | {
      outcome: "capacity_hold" | "waitlist_verification";
      registrationId: string;
      verificationExpiresAt: Date;
      capacityHoldExpiresAt: Date | null;
      deliveryStatus: "sent" | "failed";
    }
  | {
      outcome: "existing_registration";
      registrationId: string;
    }
  | { outcome: "rate_limited" }
  | { outcome: "event_unavailable" }
  | { outcome: "registration_closed" }
  | {
      outcome: "invalid";
      fieldErrors: Record<string, string[]>;
      values: RegistrationSubmissionValues;
    };

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

export function createRegistrationApplicationService({
  database,
  sendVerificationEmail,
  sendAdmissionOfferEmail = async () => undefined,
  now = () => new Date(),
  createToken = () => randomBytes(32).toString("base64url"),
  createOfferToken,
}: RegistrationApplicationDependencies) {
  async function findActiveRegistration(eventId: string, normalizedEmail: string) {
    const [active] = await database
      .select({ registrationId: registration.id })
      .from(registration)
      .where(
        and(
          eq(registration.eventId, eventId),
          eq(registration.normalizedEmail, normalizedEmail),
          inArray(registration.status, ["unconfirmed", "confirmed", "waitlisted"]),
        ),
      )
      .limit(1);
    return active ?? null;
  }

  async function submit(
    eventSlug: string,
    values: RegistrationSubmissionValues,
    requestHeaders: Headers,
  ): Promise<RegistrationSubmissionResult> {
    const submittedAt = now();
    let emailMessage: VerificationEmail | null = null;
    let offerMessages: AdmissionOfferMessage[] = [];

    let result: RegistrationSubmissionResult;
    try {
      result = await database.transaction(async (transaction) => {
        const [publishedEvent] = await transaction
          .select({
            id: event.id,
            name: event.name,
            capacity: event.capacity,
            registrationOpensAt: event.registrationOpensAt,
            registrationClosesAt: event.registrationClosesAt,
            suspended: event.suspended,
          })
          .from(event)
          .where(and(eq(event.slug, eventSlug), eq(event.status, "published")))
          .for("update")
          .limit(1);

        if (!publishedEvent) return { outcome: "registration_closed" };
        if (isEventSuspended(publishedEvent)) {
          return { outcome: "event_unavailable" };
        }
        if (
          submittedAt < publishedEvent.registrationOpensAt ||
          submittedAt >= publishedEvent.registrationClosesAt
        ) {
          return { outcome: "registration_closed" };
        }

        const fieldRows = await transaction
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
              eq(registrationField.eventId, publishedEvent.id),
              eq(registrationField.archived, false),
            ),
          )
          .orderBy(asc(registrationField.position), asc(registrationField.id));

        const choiceRows =
          fieldRows.length === 0
            ? []
            : await transaction
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
                      fieldRows.map(({ id }) => id),
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
        for (const choice of choiceRows) {
          const choices = choicesByField.get(choice.fieldId) ?? [];
          choices.push({ id: choice.id, label: choice.label });
          choicesByField.set(choice.fieldId, choices);
        }
        const fields: PublicRegistrationField[] = fieldRows.map((field) => ({
          ...field,
          answerType: field.answerType as PublicRegistrationField["answerType"],
          choices: choicesByField.get(field.id) ?? [],
        }));

        const validation = validateRegistrationSubmission(values, fields);
        if (!validation.success) {
          return { outcome: "invalid", ...validation };
        }

        if (
          await isRegistrationAttemptLimited({
            transaction,
            eventId: publishedEvent.id,
            normalizedEmail: validation.data.normalizedEmail,
            headers: requestHeaders,
            attemptedAt: submittedAt,
          })
        ) {
          return { outcome: "rate_limited" };
        }

        offerMessages = await reconcileWaitlistInTransaction({
          transaction,
          eventId: publishedEvent.id,
          reconciledAt: submittedAt,
          createOfferToken,
        });

        const [existing] = await transaction
          .select({
            registrationId: registration.id,
            status: registration.status,
            capacityOutcome: registration.capacityOutcome,
          })
          .from(registration)
          .where(
            and(
              eq(registration.eventId, publishedEvent.id),
              eq(registration.normalizedEmail, validation.data.normalizedEmail),
              inArray(registration.status, ["unconfirmed", "confirmed", "waitlisted"]),
            ),
          )
          .limit(1);
        if (existing && existing.status !== "unconfirmed") {
          return { outcome: "existing_registration", registrationId: existing.registrationId };
        }
        if (existing) {
          const [activeVerification] = await transaction
            .select({
              id: registrationVerification.id,
              expiresAt: registrationVerification.expiresAt,
            })
            .from(registrationVerification)
            .where(
              and(
                eq(
                  registrationVerification.registrationId,
                  existing.registrationId,
                ),
                isNull(registrationVerification.consumedAt),
                sql`${registrationVerification.expiresAt} > ${submittedAt}`,
              ),
            )
            .limit(1);
          if (!activeVerification) {
            return {
              outcome: "existing_registration",
              registrationId: existing.registrationId,
            };
          }

          const [hold] = await transaction
            .select({ expiresAt: capacityHold.expiresAt })
            .from(capacityHold)
            .where(
              and(
                eq(capacityHold.registrationId, existing.registrationId),
                isNull(capacityHold.claimedAt),
                sql`${capacityHold.expiresAt} > ${submittedAt}`,
              ),
            )
            .limit(1);
          if (existing.capacityOutcome === "capacity_hold" && !hold) {
            return {
              outcome: "existing_registration",
              registrationId: existing.registrationId,
            };
          }

          await transaction
            .update(registrationVerification)
            .set({ consumedAt: submittedAt })
            .where(
              and(
                eq(
                  registrationVerification.registrationId,
                  existing.registrationId,
                ),
                isNull(registrationVerification.consumedAt),
              ),
            );
          const token = createToken();
          await transaction.insert(registrationVerification).values({
            registrationId: existing.registrationId,
            tokenDigest: digestToken(token),
            expiresAt: activeVerification.expiresAt,
          });
          emailMessage = {
            email: validation.data.email,
            eventId: publishedEvent.id,
            eventName: publishedEvent.name,
            eventSlug,
            token,
          };
          return {
            outcome:
              existing.capacityOutcome === "capacity_hold"
                ? "capacity_hold"
                : "waitlist_verification",
            registrationId: existing.registrationId,
            verificationExpiresAt: activeVerification.expiresAt,
            capacityHoldExpiresAt: hold?.expiresAt ?? null,
            deliveryStatus: "sent",
          };
        }

        const [capacityUsage] = await transaction
          .select({
            confirmed: sql<number>`(
            select count(*)::int from ${registration} as confirmed_registration
            where confirmed_registration.event_id = ${publishedEvent.id}
              and confirmed_registration.status = 'confirmed'
          )`,
            holds: sql<number>`(
            select count(*)::int from ${capacityHold} as active_hold
            inner join ${registration} as held_registration
              on held_registration.id = active_hold.registration_id
            where held_registration.event_id = ${publishedEvent.id}
              and active_hold.claimed_at is null
              and active_hold.expires_at > ${submittedAt}
          )`,
            offers: sql<number>`(
            select count(*)::int from ${admissionOffer} as active_offer
            inner join ${registration} as offered_registration
              on offered_registration.id = active_offer.registration_id
            where offered_registration.event_id = ${publishedEvent.id}
              and active_offer.status = 'active'
              and active_offer.expires_at > ${submittedAt}
          )`,
          })
          .from(event)
          .where(eq(event.id, publishedEvent.id))
          .limit(1);
        const hasCapacity =
          (capacityUsage?.confirmed ?? 0) +
            (capacityUsage?.holds ?? 0) +
            (capacityUsage?.offers ?? 0) <
          publishedEvent.capacity;

        const [created] = await transaction
          .insert(registration)
          .values({
            eventId: publishedEvent.id,
            attendeeName: validation.data.name,
            email: validation.data.email,
            normalizedEmail: validation.data.normalizedEmail,
            capacityOutcome: hasCapacity ? "capacity_hold" : "waitlist",
          })
          .returning({ id: registration.id });
        if (!created) throw new Error("Could not create the Registration.");

        if (fields.length > 0) {
          await transaction.insert(registrationAnswer).values(
            fields.map((field) => ({
              registrationId: created.id,
              fieldId: field.id,
              value: validation.data.answers[field.id],
            })),
          );
          await transaction
            .update(registrationField)
            .set({ responseCount: sql`${registrationField.responseCount} + 1` })
            .where(inArray(registrationField.id, fields.map(({ id }) => id)));
        }

        const verificationExpiresAt = new Date(submittedAt.getTime() + 15 * 60_000);
        const token = createToken();
        await transaction.insert(registrationVerification).values({
          registrationId: created.id,
          tokenDigest: digestToken(token),
          expiresAt: verificationExpiresAt,
        });

        let capacityHoldExpiresAt: Date | null = null;
        if (hasCapacity) {
          capacityHoldExpiresAt = verificationExpiresAt;
          await transaction.insert(capacityHold).values({
            registrationId: created.id,
            expiresAt: capacityHoldExpiresAt,
          });
        }

        emailMessage = {
          email: validation.data.email,
          eventId: publishedEvent.id,
          eventName: publishedEvent.name,
          eventSlug,
          token,
        };
        return {
          outcome: hasCapacity ? "capacity_hold" : "waitlist_verification",
          registrationId: created.id,
          verificationExpiresAt,
          capacityHoldExpiresAt,
          deliveryStatus: "sent",
        };
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const normalizedEmail = values.email.trim().toLowerCase();
      const [publishedEvent] = await database
        .select({ id: event.id })
        .from(event)
        .where(eq(event.slug, eventSlug))
        .limit(1);
      const existing = publishedEvent
        ? await findActiveRegistration(publishedEvent.id, normalizedEmail)
        : null;
      if (!existing) throw error;
      return { outcome: "existing_registration", ...existing };
    }

    await deliverAdmissionOfferMessages(offerMessages, sendAdmissionOfferEmail);
    if (!emailMessage || !("deliveryStatus" in result)) return result;
    try {
      await sendVerificationEmail(emailMessage);
      return result;
    } catch {
      return { ...result, deliveryStatus: "failed" };
    }
  }

  return { submit, findActiveRegistration };
}
