import { normalizeStaffEmail } from "../staff-identity/normalize-staff-email";

export function evaluateStaffInvitationAcceptance(
  invitation: {
    normalizedEmail: string;
    expiresAt: Date;
    consumedAt: Date | null;
    revokedAt: Date | null;
  },
  actorEmail: string,
  now: Date,
) {
  if (
    invitation.consumedAt ||
    invitation.revokedAt ||
    invitation.expiresAt <= now
  ) {
    return "unavailable" as const;
  }
  if (normalizeStaffEmail(actorEmail) !== invitation.normalizedEmail) {
    return "email_mismatch" as const;
  }
  return "acceptable" as const;
}
