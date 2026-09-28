import "server-only";

import { and, eq } from "drizzle-orm";

import type { AdmissionOfferMessage } from "@/features/registration/server/waitlist-reconciliation";
import { digestBearerToken } from "@/lib/bearer-token-digest";
import { db } from "@/lib/db";
import { admissionOffer } from "@/lib/db/schema";
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
        // The token exists only in this message. Release an undelivered offer
        // so the next reconciliation can issue a fresh, reachable one.
        await db
          .update(admissionOffer)
          .set({ status: "expired" })
          .where(
            and(
              eq(admissionOffer.tokenDigest, digestBearerToken(message.token)),
              eq(admissionOffer.status, "active"),
            ),
          );
      }
    },
    ADMISSION_OFFER_DELIVERY_CONCURRENCY,
  );
}
