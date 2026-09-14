import { describe, expect, it } from "vitest";

import {
  isStaffMagicLinkConsumeRequest,
  isStaffMagicLinkRequestPath,
  isStaffMagicLinkVerifyPath,
  staffMagicLinkConfirmPath,
  staffMagicLinkConsumePath,
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

  it("sends email scanners to a confirm page and only consumes after an explicit confirm", () => {
    const confirmPath = staffMagicLinkConfirmPath("tok", "/events");
    expect(confirmPath).toBe("/sign-in/confirm?token=tok&callbackURL=%2Fevents");
    expect(
      isStaffMagicLinkConsumeRequest(
        new URL("https://eventpass.example/api/auth/magic-link/verify?token=tok"),
      ),
    ).toBe(false);
    expect(
      isStaffMagicLinkConsumeRequest(
        new URL(
          "https://eventpass.example/api/auth/magic-link/verify?token=tok&ep_confirm=1",
        ),
      ),
    ).toBe(true);
    expect(
      staffMagicLinkConsumePath("tok", "/events", "/sign-in?error=invalid-link"),
    ).toContain("ep_confirm=1");
  });
});
