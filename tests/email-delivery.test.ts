import assert from "node:assert/strict";
import test from "node:test";

import {
  deliverEmail,
  type EmailDeliveryUpdate,
} from "@/lib/email/deliver-email";
import { isTransientDeliveryStatusCode } from "@/lib/email/delivery-failure";

test("an uncertain send retries the same delivery and retains its attempt count", async () => {
  const keys: string[] = [];
  const updates: EmailDeliveryUpdate[] = [];
  const result = await deliverEmail({
    deliveryId: "verification",
    attemptCount: 4,
    maxAttempts: 2,
    send: async (key) => {
      keys.push(key);
      if (keys.length === 1)
        throw new Error("Connection lost after submission");
      return { kind: "submitted", id: "provider-message" };
    },
    record: async (update) => {
      updates.push(update);
    },
    onTrackingError: () => assert.fail("Tracking should succeed"),
  });
  assert.deepEqual(keys, [
    "email-delivery/verification",
    "email-delivery/verification",
  ]);
  assert.deepEqual(
    updates.map((update) => update.attemptCount),
    [5, 6],
  );
  assert.deepEqual(result, {
    outcome: "submitted",
    failureKind: null,
    providerMessageId: "provider-message",
    attemptCount: 6,
  });
});

test("accepted mail remains successful when delivery tracking fails", async () => {
  let sends = 0;
  let trackingErrors = 0;
  const result = await deliverEmail({
    deliveryId: "offer",
    attemptCount: 0,
    maxAttempts: 3,
    send: async () => {
      sends += 1;
      return { kind: "submitted", id: "accepted" };
    },
    record: async () => {
      throw new Error("Database unavailable");
    },
    onTrackingError: () => {
      trackingErrors += 1;
    },
  });
  assert.equal(result.outcome, "submitted");
  assert.equal(sends, 1);
  assert.equal(trackingErrors, 1);
});

test("permanent rejection stops retries", async () => {
  let sends = 0;
  const result = await deliverEmail({
    deliveryId: "rejected",
    attemptCount: 0,
    maxAttempts: 3,
    send: async () => {
      sends += 1;
      return { kind: "failed", failureKind: "permanent" };
    },
    record: async () => {},
    onTrackingError: () => assert.fail("Tracking should succeed"),
  });
  assert.equal(result.outcome, "permanent_failure");
  assert.equal(sends, 1);
});

test("transient retries stay bounded even when tracking is unavailable", async () => {
  let sends = 0;
  const result = await deliverEmail({
    deliveryId: "unavailable",
    attemptCount: 0,
    maxAttempts: 2,
    send: async () => {
      sends += 1;
      return { kind: "failed", failureKind: "transient" };
    },
    record: async () => {
      throw new Error("Database unavailable");
    },
    onTrackingError: () => {},
  });
  assert.deepEqual(result, {
    outcome: "transient_failure",
    failureKind: "transient",
    attemptCount: 2,
  });
  assert.equal(sends, 2);
});

test("network errors returned by the provider SDK are retryable", () => {
  for (const status of [null, undefined, 429, 500, 503]) {
    assert.equal(isTransientDeliveryStatusCode(status), true);
  }
  for (const status of [400, 401, 403, 422]) {
    assert.equal(isTransientDeliveryStatusCode(status), false);
  }
});
