import { describe, expect, it } from "vitest";

import {
  AdminSelfActionError,
  InvalidAdminReasonError,
  isPlatformAdmin,
  isSupportAccessActive,
  validateAdminReason,
  assertNotSelfAdminAction,
} from "../admin-policy";

describe("Admin Application Unit Tests", () => {
  it("requires explicit non-blank reason for all admin actions", () => {
    expect(() => validateAdminReason("")).toThrow(InvalidAdminReasonError);
    expect(() => validateAdminReason("   ")).toThrow(InvalidAdminReasonError);
    expect(validateAdminReason("Investigating security alert #102")).toBe(
      "Investigating security alert #102",
    );
  });

  it("evaluates active Support Access correctly", () => {
    const now = new Date("2026-07-23T12:00:00Z");
    const activeExpiry = new Date("2026-07-23T13:00:00Z");
    const pastExpiry = new Date("2026-07-23T11:00:00Z");

    expect(
      isSupportAccessActive({
        expiresAt: activeExpiry,
        revokedAt: null,
        now,
      }),
    ).toBe(true);

    expect(
      isSupportAccessActive({
        expiresAt: pastExpiry,
        revokedAt: null,
        now,
      }),
    ).toBe(false);

    expect(
      isSupportAccessActive({
        expiresAt: activeExpiry,
        revokedAt: new Date("2026-07-23T12:05:00Z"),
        now,
      }),
    ).toBe(false);
  });

  it("checks platform admin authorization accurately", () => {
    expect(
      isPlatformAdmin({
        userEmail: "admin@example.com",
        isPlatformAdminFlag: false,
        configuredAdminEmails: ["admin@example.com"],
      }),
    ).toBe(true);

    expect(
      isPlatformAdmin({
        userEmail: "user@example.com",
        isPlatformAdminFlag: false,
        configuredAdminEmails: ["admin@example.com"],
      }),
    ).toBe(false);
  });

  it("refuses an administrator suspending their own account", () => {
    expect(() =>
      assertNotSelfAdminAction("same-user", "same-user"),
    ).toThrow(AdminSelfActionError);
    expect(() =>
      assertNotSelfAdminAction("admin-user", "other-user"),
    ).not.toThrow();
  });
});
