import { describe, expect, it } from "vitest";

import {
  EMAIL_DELIVERY_OUTCOME_RANK,
  RESEND_EVENT_OUTCOMES,
  supersedesEmailDeliveryOutcome,
} from "./email-delivery-state";

describe("Email Delivery state transitions", () => {
  it("never overwrites a terminal permanent failure", () => {
    // Permanent failure is terminal for every possible incoming outcome.
    for (const outcome of Object.keys(EMAIL_DELIVERY_OUTCOME_RANK)) {
      expect(
        supersedesEmailDeliveryOutcome(
          outcome as keyof typeof EMAIL_DELIVERY_OUTCOME_RANK,
          "permanent_failure",
        ),
      ).toBe(false);
    }
  });

  it("does not let a late delivery delay un-suppress a bounce", () => {
    // Transient failure cannot replace a permanent failure.
    expect(
      supersedesEmailDeliveryOutcome("transient_failure", "permanent_failure"),
    ).toBe(false);
  });

  it("applies forward progress", () => {
    // Later delivery states supersede earlier states.
    expect(supersedesEmailDeliveryOutcome("delivered", "sent")).toBe(true);
    expect(supersedesEmailDeliveryOutcome("sent", "submitted")).toBe(true);
    expect(supersedesEmailDeliveryOutcome("permanent_failure", "delivered")).toBe(true);
  });

  it("rejects backward transitions", () => {
    // Earlier delivery states cannot replace later states.
    expect(supersedesEmailDeliveryOutcome("sent", "delivered")).toBe(false);
    expect(supersedesEmailDeliveryOutcome("submitted", "sent")).toBe(false);
  });

  it("treats duplicate webhook delivery as a no-op", () => {
    // Equal-ranked delivery states are idempotent.
    expect(supersedesEmailDeliveryOutcome("delivered", "delivered")).toBe(false);
  });

  it("keeps the Resend event mapping complete", () => {
    // Every supported Resend delivery event has exactly one domain outcome.
    expect(Object.keys(RESEND_EVENT_OUTCOMES).sort()).toEqual([
      "email.bounced",
      "email.complained",
      "email.delivered",
      "email.delivery_delayed",
      "email.failed",
      "email.sent",
      "email.suppressed",
    ]);
    expect(RESEND_EVENT_OUTCOMES["email.bounced"]?.outcome).toBe("permanent_failure");
  });
});
