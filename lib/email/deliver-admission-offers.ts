import "server-only";

import type { AdmissionOfferMessage } from "@/features/registration/server/waitlist-reconciliation";
import { runBoundedTasksIgnoringFailures } from "@/lib/run-bounded-tasks";

const ADMISSION_OFFER_DELIVERY_CONCURRENCY = 5;

export async function deliverAdmissionOfferMessages(
  messages: readonly AdmissionOfferMessage[],
  send: (message: AdmissionOfferMessage) => Promise<void>,
) {
  await runBoundedTasksIgnoringFailures(
    messages,
    send,
    ADMISSION_OFFER_DELIVERY_CONCURRENCY,
  );
}
