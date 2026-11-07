/**
 * Email Delivery failure classification, owned once. A rate-limit (429) or a
 * provider-side failure (5xx) or missing response is transient and retryable.
 * Other responses are permanent and suppress automatic retries. Neither reverses an already
 * committed Registration or Ticket — delivery is tracked apart from domain
 * state.
 */
export function isTransientDeliveryStatusCode(
  statusCode: number | null | undefined,
): boolean {
  return (
    statusCode === null ||
    statusCode === undefined ||
    statusCode === 429 ||
    statusCode >= 500
  );
}
