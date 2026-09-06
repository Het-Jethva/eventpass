import "server-only";

import { db } from "@/lib/db";
import { getTicketVerificationKeyObjects } from "@/features/tickets/server/ticket-signing-config";

import { createOfflineSynchronizationService } from "./offline-synchronization";
import { createCheckInConflictResolutionService } from "./check-in-conflict-resolution";

export { CheckInConflictError } from "./check-in-conflict-resolution";

const offlineSynchronization = createOfflineSynchronizationService({
  database: db,
  getVerificationKeys: getTicketVerificationKeyObjects,
});

const conflictResolution = createCheckInConflictResolutionService({
  database: db,
});

export const synchronizeOfflineAttempts =
  offlineSynchronization.synchronizeOfflineAttempts;
export const listCheckInConflicts =
  conflictResolution.listCheckInConflicts;
export const resolveCheckInConflict =
  conflictResolution.resolveCheckInConflict;
