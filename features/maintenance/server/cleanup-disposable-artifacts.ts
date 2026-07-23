import "server-only";

import { and, isNotNull, isNull, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  capacityHold,
  registrationVerification,
  session,
  verification,
} from "@/lib/db/schema";

export type CleanupSummary = {
  deletedSessions: number;
  deletedVerifications: number;
  deletedCapacityHolds: number;
  deletedRegistrationVerifications: number;
  runAt: string;
};

export async function cleanupDisposableArtifacts(
  now = new Date(),
  database = db,
): Promise<CleanupSummary> {
  const expiredSessions = await database
    .delete(session)
    .where(lt(session.expiresAt, now))
    .returning({ id: session.id });

  const expiredVerifications = await database
    .delete(verification)
    .where(lt(verification.expiresAt, now))
    .returning({ id: verification.id });

  const expiredHolds = await database
    .delete(capacityHold)
    .where(and(lt(capacityHold.expiresAt, now), isNull(capacityHold.claimedAt)))
    .returning({ id: capacityHold.id });

  const oldRegVerifications = await database
    .delete(registrationVerification)
    .where(
      and(
        lt(registrationVerification.expiresAt, now),
        isNotNull(registrationVerification.consumedAt),
      ),
    )
    .returning({ id: registrationVerification.id });

  return {
    deletedSessions: expiredSessions.length,
    deletedVerifications: expiredVerifications.length,
    deletedCapacityHolds: expiredHolds.length,
    deletedRegistrationVerifications: oldRegVerifications.length,
    runAt: now.toISOString(),
  };
}
