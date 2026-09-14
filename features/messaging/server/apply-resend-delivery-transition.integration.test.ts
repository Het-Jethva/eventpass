import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { expect, it } from "vitest";

import { describeWithDatabase, pointSharedDatabaseAtTestUrl } from "@/lib/test-db-helper";
import { applyResendDeliveryTransition } from "./apply-resend-delivery-transition";
import { emailDelivery } from "@/lib/db/schema";

pointSharedDatabaseAtTestUrl();

describeWithDatabase("Resend delivery transitions", () => {
  it("applies a higher-ranked outcome and refuses to downgrade a delivered row", async () => {
    const { db } = await import("@/lib/db");
    const providerMessageId = `resend-${randomUUID()}`;
    const [row] = await db
      .insert(emailDelivery)
      .values({
        template: "ticket-issued-v1",
        recipient: `webhook-${randomUUID()}@example.com`,
        provider: "resend",
        providerMessageId,
        outcome: "submitted",
      })
      .returning({ id: emailDelivery.id });

    await applyResendDeliveryTransition({
      database: db,
      providerMessageId,
      outcome: "delivered",
      failureKind: null,
    });
    const [delivered] = await db
      .select({ outcome: emailDelivery.outcome })
      .from(emailDelivery)
      .where(eq(emailDelivery.id, row!.id));
    expect(delivered?.outcome).toBe("delivered");

    await applyResendDeliveryTransition({
      database: db,
      providerMessageId,
      outcome: "sent",
      failureKind: null,
    });
    const [unchanged] = await db
      .select({ outcome: emailDelivery.outcome })
      .from(emailDelivery)
      .where(eq(emailDelivery.id, row!.id));
    expect(unchanged?.outcome).toBe("delivered");
  });
});
