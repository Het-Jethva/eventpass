import { describe, expect, it } from "vitest";

import {
  EMAIL_DELIVERY_OUTCOME_RANK,
  RESEND_EVENT_OUTCOMES,
} from "./email-delivery-state";

describe("Email Delivery state transitions", () => {
  it("ranks permanent failure above every other outcome", () => {
    const ranks = Object.values(EMAIL_DELIVERY_OUTCOME_RANK);
    expect(EMAIL_DELIVERY_OUTCOME_RANK.permanent_failure).toBe(Math.max(...ranks));
  });

  it("orders outcomes so the webhook SQL only moves forward", () => {
    expect(EMAIL_DELIVERY_OUTCOME_RANK.pending).toBeLessThan(
      EMAIL_DELIVERY_OUTCOME_RANK.submitted,
    );
    expect(EMAIL_DELIVERY_OUTCOME_RANK.submitted).toBeLessThan(
      EMAIL_DELIVERY_OUTCOME_RANK.transient_failure,
    );
    expect(EMAIL_DELIVERY_OUTCOME_RANK.transient_failure).toBeLessThan(
      EMAIL_DELIVERY_OUTCOME_RANK.sent,
    );
    expect(EMAIL_DELIVERY_OUTCOME_RANK.sent).toBeLessThan(
      EMAIL_DELIVERY_OUTCOME_RANK.delivered,
    );
    expect(EMAIL_DELIVERY_OUTCOME_RANK.delivered).toBeLessThan(
      EMAIL_DELIVERY_OUTCOME_RANK.permanent_failure,
    );
  });

  it("keeps the Resend event mapping complete", () => {
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
