import { eq } from "drizzle-orm";
import { Resend } from "resend";

import { db } from "@/lib/db";
import { emailDelivery } from "@/lib/db/schema";

const OUTCOMES: Record<string, { failureKind: string | null; outcome: string }> = {
  "email.bounced": { failureKind: "permanent", outcome: "permanent_failure" },
  "email.complained": { failureKind: "permanent", outcome: "permanent_failure" },
  "email.delivered": { failureKind: null, outcome: "delivered" },
  "email.delivery_delayed": { failureKind: "transient", outcome: "transient_failure" },
  "email.failed": { failureKind: "permanent", outcome: "permanent_failure" },
  "email.sent": { failureKind: null, outcome: "sent" },
  "email.suppressed": { failureKind: "permanent", outcome: "permanent_failure" },
};

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

  const transition = OUTCOMES[event.type];
  const emailId =
    event.data && typeof event.data === "object" && "email_id" in event.data
      ? event.data.email_id
      : null;

  if (transition && typeof emailId === "string" && emailId.trim().length > 0) {
    await db
      .update(emailDelivery)
      .set(transition)
      .where(eq(emailDelivery.providerMessageId, emailId.trim()));
  }

  return new Response(null, { status: 204 });
}
