export type EmailDeliveryOutcome =
  | "pending"
  | "submitted"
  | "transient_failure"
  | "sent"
  | "delivered"
  | "permanent_failure";

export const EMAIL_DELIVERY_OUTCOME_RANK: Record<EmailDeliveryOutcome, number> = {
  pending: 0,
  submitted: 1,
  transient_failure: 2,
  sent: 3,
  delivered: 4,
  permanent_failure: 5,
};

export function supersedesEmailDeliveryOutcome(
  next: EmailDeliveryOutcome,
  current: EmailDeliveryOutcome,
): boolean {
  return EMAIL_DELIVERY_OUTCOME_RANK[next] > EMAIL_DELIVERY_OUTCOME_RANK[current];
}

export const RESEND_EVENT_OUTCOMES: Record<
  string,
  {
    failureKind: "transient" | "permanent" | null;
    outcome: EmailDeliveryOutcome;
  }
> = {
  "email.bounced": { failureKind: "permanent", outcome: "permanent_failure" },
  "email.complained": { failureKind: "permanent", outcome: "permanent_failure" },
  "email.delivered": { failureKind: null, outcome: "delivered" },
  "email.delivery_delayed": { failureKind: "transient", outcome: "transient_failure" },
  "email.failed": { failureKind: "permanent", outcome: "permanent_failure" },
  "email.sent": { failureKind: null, outcome: "sent" },
  "email.suppressed": { failureKind: "permanent", outcome: "permanent_failure" },
};
