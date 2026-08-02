import "server-only";

import type { AdmissionOfferMessage } from "@/features/registration/server/waitlist-reconciliation";

const ADMISSION_OFFER_DELIVERY_CONCURRENCY = 5;

export async function deliverAdmissionOfferMessages(
  messages: readonly AdmissionOfferMessage[],
  send: (message: AdmissionOfferMessage) => Promise<void>,
) {
  const workerCount = Math.min(
    ADMISSION_OFFER_DELIVERY_CONCURRENCY,
    messages.length,
  );
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const messageIndex = nextIndex;
        nextIndex += 1;
        const message = messages[messageIndex];
        if (!message) return;

        try {
          await send(message);
        } catch {
          // Domain state is committed independently from delivery outcomes.
        }
      }
    }),
  );
}
