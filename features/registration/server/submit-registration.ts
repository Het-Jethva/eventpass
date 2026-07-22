import "server-only";

import { db } from "@/lib/db";
import { sendRegistrationVerification } from "@/lib/email/send-registration-verification";
import { sendAdmissionOffer } from "@/lib/email/send-admission-offer";
import { createRegistrationApplicationService } from "./registration-application";

const registrationApplication = createRegistrationApplicationService({
  database: db,
  sendVerificationEmail: sendRegistrationVerification,
  sendAdmissionOfferEmail: sendAdmissionOffer,
});

export const submitRegistration = registrationApplication.submit;
