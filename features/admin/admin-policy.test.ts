import { describe, expect, it } from "vitest";

import {
  InvalidAdminReasonError,
  isPlatformAdmin,
  isSupportAccessActive,
  parsePlatformAdminEmails,
  validateAdminReason,
} from "./admin-policy";

describe("Platform Administrator policy", () => {
  describe("isPlatformAdmin", () => {
    it("returns true when isPlatformAdminFlag is true", () => {
      expect(
        isPlatformAdmin({
          userEmail: "user@example.com",
          isPlatformAdminFlag: true,
        }),
      ).toBe(true);
    });

    it("returns true when email matches configured admin emails", () => {
      const configuredAdminEmails = ["admin@example.com", "ops@hetjethva.tech"];
      expect(
        isPlatformAdmin({
          userEmail: "admin@example.com",
          isPlatformAdminFlag: false,
          configuredAdminEmails,
        }),
      ).toBe(true);

      expect(
        isPlatformAdmin({
          userEmail: "OPS@hetjethva.tech",
          isPlatformAdminFlag: false,
          configuredAdminEmails,
        }),
      ).toBe(true);
    });

    it("returns false when user is neither flagged nor listed in admin emails", () => {
      expect(
        isPlatformAdmin({
          userEmail: "regular@example.com",
          isPlatformAdminFlag: false,
          configuredAdminEmails: ["admin@example.com"],
        }),
      ).toBe(false);
    });
  });

  describe("validateAdminReason", () => {
    it("returns trimmed reason when non-blank", () => {
      expect(validateAdminReason(" Account suspended due to abuse ")).toBe(
        "Account suspended due to abuse",
      );
    });

    it("throws InvalidAdminReasonError when reason is empty or whitespace", () => {
      expect(() => validateAdminReason("")).toThrow(InvalidAdminReasonError);
      expect(() => validateAdminReason("   ")).toThrow(InvalidAdminReasonError);
      expect(() => validateAdminReason(null)).toThrow(InvalidAdminReasonError);
    });
  });

  describe("isSupportAccessActive", () => {
    const now = new Date("2026-07-23T12:00:00Z");

    it("returns true when unrevoked and expiresAt is in the future", () => {
      const expiresAt = new Date("2026-07-23T13:00:00Z");
      expect(isSupportAccessActive({ expiresAt, now })).toBe(true);
    });

    it("returns false when expired", () => {
      const expiresAt = new Date("2026-07-23T11:59:59Z");
      expect(isSupportAccessActive({ expiresAt, now })).toBe(false);
    });

    it("returns false when revoked regardless of expiresAt", () => {
      const expiresAt = new Date("2026-07-23T13:00:00Z");
      const revokedAt = new Date("2026-07-23T12:05:00Z");
      expect(isSupportAccessActive({ expiresAt, revokedAt, now })).toBe(false);
    });
  });

  describe("parsePlatformAdminEmails", () => {
    it("parses comma-separated emails cleanly", () => {
      expect(
        parsePlatformAdminEmails("admin@example.com, ops@example.com , "),
      ).toEqual(["admin@example.com", "ops@example.com"]);
    });
  });
});
