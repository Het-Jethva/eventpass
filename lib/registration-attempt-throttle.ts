import "server-only";

import { createHmac } from "node:crypto";
import { and, count, eq, gte, lt, sql } from "drizzle-orm";

import { registrationAttempt } from "@/lib/db/schema";

type Database = typeof import("@/lib/db").db;
type RegistrationTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];

const EMAIL_WINDOW_MILLISECONDS = 60 * 60_000;
const IP_WINDOW_MILLISECONDS = 10 * 60_000;
const RETENTION_MILLISECONDS = 2 * 24 * 60 * 60_000;
const MAX_EMAIL_ATTEMPTS = 3;
const MAX_IP_ATTEMPTS = 50;

function digest(value: string) {
  const secret = process.env.BETTER_AUTH_SECRET;

  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is required for request throttling.");
  }

  return createHmac("sha256", secret).update(value).digest("hex");
}

function requestIp(headers: Headers) {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export async function isRegistrationAttemptLimited({
  transaction,
  eventId,
  normalizedEmail,
  headers,
  attemptedAt,
}: {
  transaction: RegistrationTransaction;
  eventId: string;
  normalizedEmail: string;
  headers: Headers;
  attemptedAt: Date;
}) {
  const emailDigest = digest(normalizedEmail);
  const ipDigest = digest(requestIp(headers));
  const emailWindowStart = new Date(
    attemptedAt.getTime() - EMAIL_WINDOW_MILLISECONDS,
  );
  const ipWindowStart = new Date(
    attemptedAt.getTime() - IP_WINDOW_MILLISECONDS,
  );
  const retentionStart = new Date(
    attemptedAt.getTime() - RETENTION_MILLISECONDS,
  );

  await transaction
    .delete(registrationAttempt)
    .where(lt(registrationAttempt.attemptedAt, retentionStart));

  const lockKeys = [
    `registration-attempt:email:${eventId}:${emailDigest}`,
    `registration-attempt:ip:${eventId}:${ipDigest}`,
  ].sort();
  for (const lockKey of lockKeys) {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`,
    );
  }

  const [emailResult] = await transaction
    .select({ value: count() })
    .from(registrationAttempt)
    .where(
      and(
        eq(registrationAttempt.eventId, eventId),
        eq(registrationAttempt.emailDigest, emailDigest),
        gte(registrationAttempt.attemptedAt, emailWindowStart),
      ),
    );
  const [ipResult] = await transaction
    .select({ value: count() })
    .from(registrationAttempt)
    .where(
      and(
        eq(registrationAttempt.eventId, eventId),
        eq(registrationAttempt.ipDigest, ipDigest),
        gte(registrationAttempt.attemptedAt, ipWindowStart),
      ),
    );

  const limited =
    (emailResult?.value ?? 0) >= MAX_EMAIL_ATTEMPTS ||
    (ipResult?.value ?? 0) >= MAX_IP_ATTEMPTS;
  if (limited) return true;

  await transaction.insert(registrationAttempt).values({
    eventId,
    emailDigest,
    ipDigest,
    attemptedAt,
  });
  return false;
}
