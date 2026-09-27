import "server-only";

import { and, eq, gt, isNull, sql } from "drizzle-orm";

import { isPlatformAdmin } from "@/features/admin/admin-policy";
import { normalizeStaffEmail } from "@/features/staff-identity/normalize-staff-email";
import { db } from "@/lib/db";
import { event, staffInvitation, user } from "@/lib/db/schema";

export async function isEligibleStaffMagicLinkRecipient(
  email: string,
  now = new Date(),
) {
  const normalizedEmail = normalizeStaffEmail(email);
  if (!normalizedEmail) return false;

  const [existing] = await db
    .select({ id: user.id, suspended: user.suspended })
    .from(user)
    .where(sql`lower(btrim(${user.email})) = ${normalizedEmail}`)
    .limit(1);
  // A suspended staff member must fail here, before any email goes out:
  // without this they receive a magic link only to be bounced at session
  // creation. An unsuspended account is eligible on its own; a pending Staff
  // Invitation on some other suspended Event must not override that.
  if (existing?.suspended) return false;
  if (existing) return true;

  if (isPlatformAdmin({ userEmail: normalizedEmail })) return true;

  // Invitees have no user row until they sign in; the invitation page requires
  // a session for that address before it can be accepted. The invitation
  // cannot be accepted while the Event is suspended, so do not send a link
  // that cannot work. Filter to a live Event rather than taking an arbitrary
  // pending row: another invitation may still be usable.
  const [invitation] = await db
    .select({ id: staffInvitation.id })
    .from(staffInvitation)
    .innerJoin(event, eq(event.id, staffInvitation.eventId))
    .where(
      and(
        eq(staffInvitation.normalizedEmail, normalizedEmail),
        isNull(staffInvitation.consumedAt),
        isNull(staffInvitation.revokedAt),
        gt(staffInvitation.expiresAt, now),
        eq(event.suspended, false),
      ),
    )
    .limit(1);

  return Boolean(invitation);
}
