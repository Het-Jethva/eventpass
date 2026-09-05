import "server-only";

import { and, count, eq, gte, lt, sql } from "drizzle-orm";

import { normalizeStaffEmail } from "@/features/staff-identity/normalize-staff-email";
import { db } from "@/lib/db";
import { authenticationAttempt } from "@/lib/db/schema";
import { requestIp, throttleDigest as digest } from "@/lib/request-throttle-helpers";

const WINDOW_MILLISECONDS = 60_000;
const MAX_ATTEMPTS = 3;

async function isAuthenticationAttemptLimited(scopeKey: string, headers: Headers) {
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const emailKey = digest(scopeKey);
  const ipKey = digest(`ip:${day}:${requestIp(headers)}`);
  const lockKeys = [emailKey, ipKey].sort();
  const windowStart = new Date(now.getTime() - WINDOW_MILLISECONDS);
  const retentionStart = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1_000);

  return db.transaction(async (transaction) => {
    await transaction
      .delete(authenticationAttempt)
      .where(lt(authenticationAttempt.attemptedAt, retentionStart));

    for (const lockKey of lockKeys) {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`,
      );
    }

    const [emailResult] = await transaction
      .select({ value: count() })
      .from(authenticationAttempt)
      .where(
        and(
          gte(authenticationAttempt.attemptedAt, windowStart),
          eq(authenticationAttempt.emailKey, emailKey),
        ),
      );
    const [ipResult] = await transaction
      .select({ value: count() })
      .from(authenticationAttempt)
      .where(
        and(
          gte(authenticationAttempt.attemptedAt, windowStart),
          eq(authenticationAttempt.ipKey, ipKey),
        ),
      );

    await transaction.insert(authenticationAttempt).values({ emailKey, ipKey, attemptedAt: now });

    return (
      (emailResult?.value ?? 0) >= MAX_ATTEMPTS ||
      (ipResult?.value ?? 0) >= MAX_ATTEMPTS
    );
  });
}

export function isMagicLinkRequestLimited(email: string, headers: Headers) {
  return isAuthenticationAttemptLimited(
    `email:${normalizeStaffEmail(email)}`,
    headers,
  );
}

export function isMagicLinkVerificationLimited(token: string, headers: Headers) {
  return isAuthenticationAttemptLimited(`magic-link:${token}`, headers);
}
