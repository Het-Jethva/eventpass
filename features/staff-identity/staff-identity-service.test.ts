import { describe, expect, it, vi } from "vitest";

import { createStaffIdentityService } from "./staff-identity-service";

describe("staff identity application service", () => {
  it("requests a magic link for the normalized email address", async () => {
    const requestMagicLink = vi.fn().mockResolvedValue(undefined);
    const service = createStaffIdentityService({
      requestMagicLink,
      getSession: vi.fn(),
      revokeCurrentSession: vi.fn(),
    });

    const result = await service.requestMagicLink("  Staff.Member@Example.COM  ");

    expect(result).toEqual({ status: "sent" });
    expect(requestMagicLink).toHaveBeenCalledWith({
      callbackURL: "/events",
      email: "staff.member@example.com",
      errorCallbackURL: "/sign-in?error=invalid-link",
    });
  });

  it("rejects a suspended staff session and revokes it", async () => {
    const revokeCurrentSession = vi.fn().mockResolvedValue(undefined);
    const service = createStaffIdentityService({
      requestMagicLink: vi.fn(),
      getSession: vi.fn().mockResolvedValue({
        session: { id: "session-1" },
        user: {
          email: "staff@example.com",
          id: "staff-1",
          name: "Staff member",
          suspended: true,
        },
      }),
      revokeCurrentSession,
    });

    await expect(service.getActiveSession()).resolves.toBeNull();
    expect(revokeCurrentSession).toHaveBeenCalledOnce();
  });

  it("revokes the current database session when staff signs out", async () => {
    const revokeCurrentSession = vi.fn().mockResolvedValue(undefined);
    const service = createStaffIdentityService({
      requestMagicLink: vi.fn(),
      getSession: vi.fn(),
      revokeCurrentSession,
    });

    await service.signOut();

    expect(revokeCurrentSession).toHaveBeenCalledOnce();
  });
});
