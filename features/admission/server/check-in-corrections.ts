import "server-only";

import { db } from "@/lib/db";

import { createCheckInCorrectionService } from "./check-in-correction-application";

const checkInCorrectionService = createCheckInCorrectionService({
  database: db,
});

export const reverseCheckIn = checkInCorrectionService.reverseCheckIn;
export const listActiveCheckIns = checkInCorrectionService.listActiveCheckIns;
