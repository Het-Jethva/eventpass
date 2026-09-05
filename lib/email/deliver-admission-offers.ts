import "server-only";

import type { AdmissionOfferMessage } from "@/features/registration/server/waitlist-reconciliation";
import { runBoundedTasks } from "@/lib/run-bounded-tasks";

const ADMISSION_OFFER_DELIVERY_CONCURRENCY = 5;

export async function deliverAdmissionOfferMessages(
  messages: readonly AdmissionOfferMessage[],
  send: (message: AdmissionOfferMessage) => Promise<void>,
) {
  await runBoundedTasks(
    messages,
    async (message) => {
      try {
        await send(message);
      } catch {
        // Domain state is committed independently from delivery outcomes.
      }
    },
    ADMISSION_OFFER_DELIVERY_CONCURRENCY,
  );
}
