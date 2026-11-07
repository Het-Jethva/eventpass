import "server-only";

import { sql } from "drizzle-orm";

import { normalizeStaffEmail } from "@/features/staff-identity/normalize-staff-email";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";

export async function isEligibleStaffMagicLinkRecipient(email: string) {
  const normalizedEmail = normalizeStaffEmail(email);
  if (!normalizedEmail) return false;

  const [existing] = await db
    .select({ suspended: user.suspended })
    .from(user)
    .where(sql`lower(btrim(${user.email})) = ${normalizedEmail}`)
    .limit(1);
  // New organizers can sign up; suspended accounts cannot receive sign-in mail.
  return !existing?.suspended;
}
