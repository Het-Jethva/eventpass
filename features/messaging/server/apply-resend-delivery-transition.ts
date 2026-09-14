import "server-only";

import { and, eq, sql } from "drizzle-orm";

import {
  EMAIL_DELIVERY_OUTCOME_RANK,
  type EmailDeliveryOutcome,
} from "@/features/messaging/email-delivery-state";
import { emailDelivery } from "@/lib/db/schema";

type DeliveryDatabase = typeof import("@/lib/db").db;

const CURRENT_OUTCOME_RANK = sql<number>`case ${emailDelivery.outcome} ${sql.join(
  (
    Object.entries(EMAIL_DELIVERY_OUTCOME_RANK) as [
      EmailDeliveryOutcome,
      number,
    ][]
  ).map(([outcome, rank]) => sql`when ${outcome} then ${rank}`),
  sql` `,
)} end`;

export async function applyResendDeliveryTransition({
  database,
  providerMessageId,
  outcome,
  failureKind,
}: {
  database: DeliveryDatabase;
  providerMessageId: string;
  outcome: EmailDeliveryOutcome;
  failureKind: "transient" | "permanent" | null;
}) {
  await database
    .update(emailDelivery)
    .set({ outcome, failureKind })
    .where(
      and(
        eq(emailDelivery.providerMessageId, providerMessageId),
        sql`${CURRENT_OUTCOME_RANK} < ${EMAIL_DELIVERY_OUTCOME_RANK[outcome]}`,
      ),
    );
}
