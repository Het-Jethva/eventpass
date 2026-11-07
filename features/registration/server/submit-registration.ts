import "server-only";

import { randomBytes } from "node:crypto";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import {
  getActiveCapacityUsage,
  hasCapacityForNewClaim,
} from "@/features/events/server/capacity-ledger";
import { isEventSuspended } from "@/features/events/server/event-suspension";
import { digestBearerToken as digestToken } from "@/lib/bearer-token-digest";
import { db } from "@/lib/db";
import { deliverAdmissionOfferMessages } from "@/lib/email/deliver-admission-offers";
import { sendAdmissionOffer } from "@/lib/email/send-admission-offer";
import { sendRegistrationVerification } from "@/lib/email/send-registration-verification";
import { isRecord } from "@/lib/is-record";
import { isUniqueViolation } from "@/lib/is-unique-violation";
import { isRegistrationAttemptLimited } from "@/lib/registration-attempt-throttle";

import {
  capacityHold,
  event,
  registration,
  registrationAnswer,
  registrationField,
  registrationVerification,
} from "../../../lib/db/schema";
import {
  validateRegistrationSubmission,
  type RegistrationSubmissionValues,
} from "../registration-submission";
import { getPublicRegistrationForm } from "./get-public-registration-form";
import {
  reconcileWaitlistInTransaction,
  type AdmissionOfferMessage,
} from "./waitlist-reconciliation";

type VerificationEmail = {
  email: string;
  eventId: string;
  eventName: string;
  eventSlug: string;
  token: string;
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

async function findActiveRegistration(
  eventId: string,
  normalizedEmail: string,
) {
  const [active] = await db
    .select({ registrationId: registration.id })
    .from(registration)
    .where(
      and(
        eq(registration.eventId, eventId),
        eq(registration.normalizedEmail, normalizedEmail),
        inArray(registration.status, [
          "unconfirmed",
          "confirmed",
          "waitlisted",
        ]),
      ),
    )
    .limit(1);
  return active ?? null;
}

export async function submitRegistration(
  eventSlug: string,
  values: RegistrationSubmissionValues,
  requestHeaders: Headers,
): Promise<RegistrationSubmissionResult> {
  // Cheap guards before acquiring the per-event row lock: obviously
  // malformed submissions must not cost a FOR UPDATE lock and field load.
  if (
    typeof eventSlug !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(eventSlug)
  ) {
    return { outcome: "registration_closed" };
  }
  const earlyErrors: Record<string, string[]> = {};
  const earlyName = typeof values?.name === "string" ? values.name.trim() : "";
  const earlyEmail =
    typeof values?.email === "string" ? values.email.trim() : "";
  if (!earlyName) earlyErrors.name = ["Enter your name."];
  else if (earlyName.length > 200) earlyErrors.name = ["Name is too long."];
  if (!earlyEmail) earlyErrors.email = ["Enter a valid email address."];
  else if (earlyEmail.length > 320 || !earlyEmail.includes("@")) {
    earlyErrors.email = ["Enter a valid email address."];
  }
  if (
    !values ||
    typeof values.answers !== "object" ||
    values.answers === null
  ) {
    earlyErrors.answers = ["Invalid submission."];
  }
  if (Object.keys(earlyErrors).length > 0) {
    return {
      outcome: "invalid",
      fieldErrors: earlyErrors,
      values: {
        name: typeof values?.name === "string" ? values.name : "",
        email: typeof values?.email === "string" ? values.email : "",
        answers: isRecord(values?.answers) ? values.answers : {},
      },
    };
  }
  const submittedAt = new Date();
  let emailMessage: VerificationEmail | null = null;
  const deliveryState: {
    replacementVerification: { previousId: string; newId: string } | null;
  } = { replacementVerification: null };
  let offerMessages: AdmissionOfferMessage[] = [];

  let result: RegistrationSubmissionResult;
  try {
    result = await db.transaction(async (transaction) => {
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

      const fields = await getPublicRegistrationForm(
        publishedEvent.id,
        transaction,
      );

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
            inArray(registration.status, [
              "unconfirmed",
              "confirmed",
              "waitlisted",
            ]),
          ),
        )
        .limit(1);
      if (existing && existing.status !== "unconfirmed") {
        return {
          outcome: "existing_registration",
          registrationId: existing.registrationId,
        };
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

        const token = randomBytes(32).toString("base64url");
        const [newVerification] = await transaction
          .insert(registrationVerification)
          .values({
            registrationId: existing.registrationId,
            tokenDigest: digestToken(token),
            expiresAt: activeVerification.expiresAt,
          })
          .returning({ id: registrationVerification.id });
        if (!newVerification)
          throw new Error("Could not create the verification link.");
        deliveryState.replacementVerification = {
          previousId: activeVerification.id,
          newId: newVerification.id,
        };
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

      const usage = await getActiveCapacityUsage(
        transaction,
        publishedEvent.id,
        submittedAt,
      );
      const hasCapacity = hasCapacityForNewClaim(
        usage,
        publishedEvent.capacity,
      );

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
          .where(
            inArray(
              registrationField.id,
              fields.map(({ id }) => id),
            ),
          );
      }

      const verificationExpiresAt = new Date(
        submittedAt.getTime() + 15 * 60_000,
      );
      const token = randomBytes(32).toString("base64url");
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
    const [publishedEvent] = await db
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

  await deliverAdmissionOfferMessages(offerMessages, sendAdmissionOffer);
  if (!emailMessage || !("deliveryStatus" in result)) return result;
  try {
    await sendRegistrationVerification(emailMessage);
  } catch {
    if (deliveryState.replacementVerification) {
      await db
        .update(registrationVerification)
        .set({ consumedAt: submittedAt })
        .where(
          eq(
            registrationVerification.id,
            deliveryState.replacementVerification.newId,
          ),
        );
    }
    return { ...result, deliveryStatus: "failed" };
  }
  if (deliveryState.replacementVerification) {
    await db
      .update(registrationVerification)
      .set({ consumedAt: submittedAt })
      .where(
        eq(
          registrationVerification.id,
          deliveryState.replacementVerification.previousId,
        ),
      );
  }
  return result;
}
