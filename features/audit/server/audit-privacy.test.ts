import { describe, expect, it } from "vitest";

import {
  isSensitiveAuditField,
  sanitizeAuditEntryMetadata,
} from "../audit-privacy-policy";

describe("Audit Data Privacy Sanitization", () => {
  it("detects sensitive audit fields that must be excluded", () => {
    expect(isSensitiveAuditField("registrationAnswers")).toBe(true);
    expect(isSensitiveAuditField("answers")).toBe(true);
    expect(isSensitiveAuditField("bearerToken")).toBe(true);
    expect(isSensitiveAuditField("managementToken")).toBe(true);
    expect(isSensitiveAuditField("messageBody")).toBe(true);
    expect(isSensitiveAuditField("rawQrInput")).toBe(true);

    expect(isSensitiveAuditField("authoritativeScanAttemptId")).toBe(false);
    expect(isSensitiveAuditField("importedCount")).toBe(false);
  });

  it("strips sensitive fields from audit metadata object", () => {
    const rawMetadata = {
      authoritativeScanAttemptId: "attempt-123",
      bearerToken: "secret-token-abc",
      registrationAnswers: { q1: "Secret Answer" },
      rawQrInput: "UNPARSED_RAW_QR_CONTENT",
      importedCount: 15,
    };

    const sanitized = sanitizeAuditEntryMetadata(rawMetadata);

    expect(sanitized).toEqual({
      authoritativeScanAttemptId: "attempt-123",
      importedCount: 15,
    });
    expect(sanitized).not.toHaveProperty("bearerToken");
    expect(sanitized).not.toHaveProperty("registrationAnswers");
    expect(sanitized).not.toHaveProperty("rawQrInput");
  });
});
