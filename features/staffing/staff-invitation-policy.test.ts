import { describe, expect, it } from "vitest";

import { evaluateStaffInvitationAcceptance } from "./staff-invitation-policy";

const now = new Date("2030-01-01T12:00:00.000Z");
const pendingInvitation = {
  normalizedEmail: "organizer@example.com",
  expiresAt: new Date("2030-01-02T12:00:00.000Z"),
  consumedAt: null,
  revokedAt: null,
};

describe("Staff Invitation acceptance", () => {
  it("matches the authenticated normalized email address", () => {
    expect(
      evaluateStaffInvitationAcceptance(
        pendingInvitation,
        " Organizer@Example.COM ",
        now,
      ),
    ).toBe("acceptable");
    expect(
      evaluateStaffInvitationAcceptance(pendingInvitation, "other@example.com", now),
    ).toBe("email_mismatch");
  });

  it("rejects expired, consumed, and revoked invitations", () => {
    expect(
      evaluateStaffInvitationAcceptance(
        { ...pendingInvitation, expiresAt: now },
        "organizer@example.com",
        now,
      ),
    ).toBe("unavailable");
    expect(
      evaluateStaffInvitationAcceptance(
        { ...pendingInvitation, consumedAt: now },
        "organizer@example.com",
        now,
      ),
    ).toBe("unavailable");
    expect(
      evaluateStaffInvitationAcceptance(
        { ...pendingInvitation, revokedAt: now },
        "organizer@example.com",
        now,
      ),
    ).toBe("unavailable");
  });
});
