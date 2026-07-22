import "server-only";

import { db } from "@/lib/db";
import { sendRegistrationVerification } from "@/lib/email/send-registration-verification";
import { createRegistrationApplicationService } from "./registration-application";

const registrationApplication = createRegistrationApplicationService({
  database: db,
  sendVerificationEmail: sendRegistrationVerification,
});

export const submitRegistration = registrationApplication.submit;
