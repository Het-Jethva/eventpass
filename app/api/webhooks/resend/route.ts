import { and, eq, sql } from "drizzle-orm";
import { Resend } from "resend";

import {
  EMAIL_DELIVERY_OUTCOME_RANK,
  RESEND_EVENT_OUTCOMES,
  type EmailDeliveryOutcome,
} from "@/features/messaging/email-delivery-state";
import { db } from "@/lib/db";
import { emailDelivery } from "@/lib/db/schema";

const CURRENT_OUTCOME_RANK = sql<number>`case ${emailDelivery.outcome} ${sql.join(
  (
    Object.entries(EMAIL_DELIVERY_OUTCOME_RANK) as [
      EmailDeliveryOutcome,
      number,
    ][]
  ).map(([outcome, rank]) => sql`when ${outcome} then ${rank}`),
  sql` `,
)} end`;

export async function POST(request: Request) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return new Response("Webhook is not configured.", { status: 503 });
  }

  const payload = await request.text();
  let event;

  try {
    event = new Resend(process.env.RESEND_API_KEY).webhooks.verify({
      headers: {
        id: request.headers.get("svix-id") ?? "",
        signature: request.headers.get("svix-signature") ?? "",
        timestamp: request.headers.get("svix-timestamp") ?? "",
      },
      payload,
      webhookSecret,
    });
  } catch {
    return new Response("Invalid signature.", { status: 400 });
  }

  const transition = RESEND_EVENT_OUTCOMES[event.type];
  const emailId =
    event.data && typeof event.data === "object" && "email_id" in event.data
      ? event.data.email_id
      : null;

  if (transition && typeof emailId === "string" && emailId.trim().length > 0) {
    await db
      .update(emailDelivery)
      .set(transition)
      .where(
        and(
          eq(emailDelivery.providerMessageId, emailId.trim()),
          sql`${CURRENT_OUTCOME_RANK} < ${EMAIL_DELIVERY_OUTCOME_RANK[transition.outcome]}`,
        ),
      );
  }

  return new Response(null, { status: 204 });
}
