type EmailFailureKind = "transient" | "permanent";

type SendResult =
  | { kind: "submitted"; id: string }
  | { kind: "failed"; failureKind: EmailFailureKind };

export type EmailDeliveryUpdate =
  | {
      outcome: "submitted";
      failureKind: null;
      providerMessageId: string;
      attemptCount: number;
    }
  | {
      outcome: "transient_failure";
      failureKind: "transient";
      attemptCount: number;
    }
  | {
      outcome: "permanent_failure";
      failureKind: "permanent";
      attemptCount: number;
    };

export async function deliverEmail({
  deliveryId,
  attemptCount,
  maxAttempts,
  send,
  record,
  onTrackingError,
}: {
  deliveryId: string;
  attemptCount: number;
  maxAttempts: 1 | 2 | 3;
  send: (idempotencyKey: string) => Promise<SendResult>;
  record: (update: EmailDeliveryUpdate) => Promise<void>;
  onTrackingError: (error: unknown) => void;
}): Promise<EmailDeliveryUpdate> {
  const idempotencyKey = `email-delivery/${deliveryId}`;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let result: SendResult;
    try {
      result = await send(idempotencyKey);
    } catch {
      result = { kind: "failed", failureKind: "transient" };
    }
    attemptCount += 1;

    const update: EmailDeliveryUpdate =
      result.kind === "submitted"
        ? {
            outcome: "submitted",
            failureKind: null,
            providerMessageId: result.id,
            attemptCount,
          }
        : result.failureKind === "transient"
          ? {
              outcome: "transient_failure",
              failureKind: "transient",
              attemptCount,
            }
          : {
              outcome: "permanent_failure",
              failureKind: "permanent",
              attemptCount,
            };
    try {
      await record(update);
    } catch (error) {
      onTrackingError(error);
    }

    if (
      update.outcome === "submitted" ||
      update.outcome === "permanent_failure"
    ) {
      return update;
    }
  }

  return {
    outcome: "transient_failure",
    failureKind: "transient",
    attemptCount,
  };
}
