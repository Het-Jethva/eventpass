import { Resend } from "resend";

import { RESEND_EVENT_OUTCOMES } from "@/features/messaging/email-delivery-state";
import { applyResendDeliveryTransition } from "@/features/messaging/server/apply-resend-delivery-transition";
import { db } from "@/lib/db";

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
    await applyResendDeliveryTransition({
      database: db,
      providerMessageId: emailId.trim(),
      outcome: transition.outcome,
      failureKind: transition.failureKind,
    });
  }

  return new Response(null, { status: 204 });
}
