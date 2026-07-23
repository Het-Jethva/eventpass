import "server-only";

import { db } from "@/lib/db";
import {
  getActiveTicketSigningKey,
  getTicketVerificationKeys,
} from "@/features/tickets/server/ticket-signing-config";

import { createScannerPreparationService } from "./scanner-preparation";

const scannerPreparation = createScannerPreparationService({
  database: db,
  getSigningKey: getActiveTicketSigningKey,
  getVerificationKeys: getTicketVerificationKeys,
});

export const prepareOfflineScanner =
  scannerPreparation.prepareOfflineScanner;
