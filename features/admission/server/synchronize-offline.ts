import "server-only";

import { db } from "@/lib/db";
import { getTicketVerificationKeyObjects } from "@/features/tickets/server/ticket-signing-config";

import { createOfflineSynchronizationService } from "./offline-synchronization";

const offlineSynchronization = createOfflineSynchronizationService({
  database: db,
  getVerificationKeys: getTicketVerificationKeyObjects,
});

export const synchronizeOfflineAttempts =
  offlineSynchronization.synchronizeOfflineAttempts;
export const listCheckInConflicts =
  offlineSynchronization.listCheckInConflicts;
export const resolveCheckInConflict =
  offlineSynchronization.resolveCheckInConflict;
