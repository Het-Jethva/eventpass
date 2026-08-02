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

export function sanitizeAuditEntryMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!isSensitiveAuditField(key)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        sanitized[key] = sanitizeAuditEntryMetadata(
          value as Record<string, unknown>,
        );
      } else {
        sanitized[key] = value;
      }
    }
  }
  return sanitized;
}
