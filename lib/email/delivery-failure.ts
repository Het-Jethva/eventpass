/**
 * Email Delivery failure classification, owned once. A rate-limit (429) or a
 * provider-side failure (5xx) is transient and retryable; anything else is
 * permanent and suppresses automatic retries. Neither reverses an already
 * committed Registration or Ticket — delivery is tracked apart from domain
 * state.
 */
export function isTransientDeliveryStatusCode(
  statusCode: number | null | undefined,
): boolean {
  return (
    statusCode === 429 ||
    (statusCode !== null && statusCode !== undefined && statusCode >= 500)
  );
}
