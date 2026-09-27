import { isRecord } from "@/lib/is-record";

const SENSITIVE_FIELDS = new Set([
  "registrationanswers",
  "answers",
  "bearertoken",
  "token",
  "tokendigest",
  "managementtoken",
  "managementtokendigest",
  "messagebody",
  "rawqrinput",
  "rawinput",
  "ticketcode",
  "signedpayload",
  "ticketjws",
  "password",
  "secret",
]);

export function isSensitiveAuditField(fieldName: string): boolean {
  return SENSITIVE_FIELDS.has(fieldName.toLowerCase());
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (isRecord(value)) return sanitizeAuditEntryMetadata(value);
  return value;
}

export function sanitizeAuditEntryMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitiveAuditField(key)) continue;
    sanitized[key] = sanitizeValue(value);
  }
  return sanitized;
}
