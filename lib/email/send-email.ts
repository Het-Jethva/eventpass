import "server-only";

import { eq, sql } from "drizzle-orm";
import { Resend, type CreateEmailOptions } from "resend";

import { db } from "@/lib/db";
import { emailDelivery } from "@/lib/db/schema";
import { deliverEmail } from "./deliver-email";
import { isTransientDeliveryStatusCode } from "./delivery-failure";

type Delivery =
  | { kind: "new"; template: string; eventId?: string }
  | { kind: "existing"; id: string; attemptCount: number };

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: CreateEmailOptions["attachments"];
};

export class EmailDeliveryError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "EmailDeliveryError";
    this.retryable = retryable;
  }
}

export async function sendEmail({
  delivery,
  message,
  maxAttempts = 1,
  failureMessage,
}: {
  delivery: Delivery;
  message: EmailMessage;
  maxAttempts?: 1 | 2 | 3;
  failureMessage: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is required to send email.");

  const existing = delivery.kind === "existing" ? delivery : null;
  const created =
    delivery.kind === "new"
      ? await db
          .insert(emailDelivery)
          .values({
            template: delivery.template,
            recipient: message.to,
            provider: "resend",
            eventId: delivery.eventId,
            outcome: "pending",
          })
          .returning({
            id: emailDelivery.id,
            attemptCount: emailDelivery.attemptCount,
          })
      : [];
  const tracked = existing ?? created[0];
  if (!tracked) throw new Error("Could not create the Email Delivery record.");

  const resend = new Resend(apiKey);
  const result = await deliverEmail({
    deliveryId: tracked.id,
    attemptCount: tracked.attemptCount,
    maxAttempts,
    send: async (idempotencyKey) => {
      const response = await resend.emails.send(
        {
          from:
            process.env.RESEND_FROM_EMAIL ??
            "EventPass <tickets@mail.hetjethva.tech>",
          ...message,
        },
        { idempotencyKey },
      );
      if (!response.error) return { kind: "submitted", id: response.data.id };
      return {
        kind: "failed",
        failureKind: isTransientDeliveryStatusCode(response.error.statusCode)
          ? "transient"
          : "permanent",
      };
    },
    record: async (update) => {
      // A webhook or concurrent send may have settled the delivery already.
      const mutable = sql`${emailDelivery.outcome} in ('pending', 'transient_failure')`;
      await db
        .update(emailDelivery)
        .set({
          attemptCount: sql`greatest(${emailDelivery.attemptCount}, ${update.attemptCount})`,
          outcome: sql`case when ${mutable} then ${update.outcome} else ${emailDelivery.outcome} end`,
          failureKind: sql`case when ${mutable} then ${update.failureKind} else ${emailDelivery.failureKind} end`,
          ...(update.outcome === "submitted"
            ? { providerMessageId: update.providerMessageId }
            : {}),
        })
        .where(eq(emailDelivery.id, tracked.id));
    },
    onTrackingError: () => {
      console.error("Email delivery tracking failed", {
        deliveryId: tracked.id,
      });
    },
  });
  if (result.outcome !== "submitted") {
    throw new EmailDeliveryError(
      failureMessage,
      result.failureKind === "transient",
    );
  }
}
