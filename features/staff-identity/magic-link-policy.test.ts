import { describe, expect, it } from "vitest";

import {
  isStaffMagicLinkRequestPath,
  isStaffMagicLinkVerifyPath,
  shouldSendStaffMagicLink,
} from "./magic-link-policy";

describe("staff magic-link paths", () => {
  it("matches Better Auth send and verify routes with or without a trailing slash", () => {
    expect(isStaffMagicLinkRequestPath("/api/auth/sign-in/magic-link")).toBe(
      true,
    );
    expect(isStaffMagicLinkRequestPath("/api/auth/sign-in/magic-link/")).toBe(
      true,
    );
    expect(isStaffMagicLinkVerifyPath("/api/auth/magic-link/verify")).toBe(
      true,
    );
    expect(isStaffMagicLinkVerifyPath("/api/auth/magic-link/verify/")).toBe(
      true,
    );
    expect(isStaffMagicLinkRequestPath("/api/auth/sign-in/email")).toBe(false);
  });
});

describe("staff magic-link send gate", () => {
  it("sends only to existing staff, pending invitations, or configured Platform Administrators", () => {
    expect(
      shouldSendStaffMagicLink({
        hasAccount: false,
        hasPendingInvitation: false,
        isConfiguredPlatformAdmin: false,
      }),
    ).toBe(false);
    expect(
      shouldSendStaffMagicLink({
        hasAccount: true,
        hasPendingInvitation: false,
        isConfiguredPlatformAdmin: false,
      }),
    ).toBe(true);
    expect(
      shouldSendStaffMagicLink({
        hasAccount: false,
        hasPendingInvitation: true,
        isConfiguredPlatformAdmin: false,
      }),
    ).toBe(true);
    expect(
      shouldSendStaffMagicLink({
        hasAccount: false,
        hasPendingInvitation: false,
        isConfiguredPlatformAdmin: true,
      }),
    ).toBe(true);
  });
});
