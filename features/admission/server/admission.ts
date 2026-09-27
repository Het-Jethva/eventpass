import "server-only";

import { db } from "@/lib/db";
import { getTicketVerificationKeyObjects } from "@/features/tickets/server/ticket-signing-config";

import { createAdmissionApplicationService } from "./admission-application";

const admissionApplication = createAdmissionApplicationService({
  database: db,
  getVerificationKeys: getTicketVerificationKeyObjects,
});

export const admitOnline = admissionApplication.admitOnline;
