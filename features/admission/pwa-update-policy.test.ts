import { describe, expect, it } from "vitest";
import {
  shouldDeferUpdate,
  shouldPurgeCachedEvent,
} from "./pwa-update-policy";

describe("PWA Update & Purge Policy", () => {
  it("defers application update when unsynchronized scan attempts exist", () => {
    expect(shouldDeferUpdate({ pendingAttemptCount: 3 })).toBe(true);
    expect(shouldDeferUpdate({ pendingAttemptCount: 1 })).toBe(true);
    expect(shouldDeferUpdate({ pendingAttemptCount: 0 })).toBe(false);
  });

  it("purges cached Event data only after check-in closes and all pending attempts are acknowledged", () => {
    expect(
      shouldPurgeCachedEvent({ checkInClosed: false, pendingAttemptCount: 0 }),
    ).toBe(false);
    expect(
      shouldPurgeCachedEvent({ checkInClosed: true, pendingAttemptCount: 2 }),
    ).toBe(false);
    expect(
      shouldPurgeCachedEvent({ checkInClosed: true, pendingAttemptCount: 0 }),
    ).toBe(true);
  });
});
