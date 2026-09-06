import { describe, expect, it } from "vitest";

import { isTransientDeliveryStatusCode } from "./delivery-failure";

describe("isTransientDeliveryStatusCode", () => {
  it("retries rate limits and provider failures", () => {
    expect(isTransientDeliveryStatusCode(429)).toBe(true);
    expect(isTransientDeliveryStatusCode(500)).toBe(true);
    expect(isTransientDeliveryStatusCode(503)).toBe(true);
  });

  it("suppresses retries for recipient failures", () => {
    expect(isTransientDeliveryStatusCode(400)).toBe(false);
    expect(isTransientDeliveryStatusCode(404)).toBe(false);
    expect(isTransientDeliveryStatusCode(422)).toBe(false);
  });

  it("treats a missing status as permanent", () => {
    expect(isTransientDeliveryStatusCode(null)).toBe(false);
    expect(isTransientDeliveryStatusCode(undefined)).toBe(false);
  });
});
