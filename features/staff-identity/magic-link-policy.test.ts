import { describe, expect, it } from "vitest";

import {
  isStaffMagicLinkRequestPath,
  isStaffMagicLinkVerifyPath,
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
    expect(
      isStaffMagicLinkRequestPath("/api/auth/nested/sign-in/magic-link"),
    ).toBe(false);
  });
});
