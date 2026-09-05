import "server-only";

import { and, eq, gt, isNull, sql } from "drizzle-orm";

import { isPlatformAdmin } from "@/features/admin/admin-policy";
import { normalizeStaffEmail } from "@/features/staff-identity/normalize-staff-email";
import { db } from "@/lib/db";
import { staffInvitation, user } from "@/lib/db/schema";

export async function isEligibleStaffMagicLinkRecipient(
  email: string,
  now = new Date(),
) {
  const normalizedEmail = normalizeStaffEmail(email);
  if (!normalizedEmail) return false;

  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(sql`lower(btrim(${user.email})) = ${normalizedEmail}`)
    .limit(1);

  const [invitation] = await db
    .select({ id: staffInvitation.id })
    .from(staffInvitation)
    .where(
      and(
        eq(staffInvitation.normalizedEmail, normalizedEmail),
        isNull(staffInvitation.consumedAt),
        isNull(staffInvitation.revokedAt),
        gt(staffInvitation.expiresAt, now),
      ),
    )
    .limit(1);

  // Invitees have no user row until they sign in; the invitation page requires
  // a session for that address before it can be accepted.
  return (
    Boolean(existing) ||
    Boolean(invitation) ||
    isPlatformAdmin({ userEmail: normalizedEmail })
  );
}
