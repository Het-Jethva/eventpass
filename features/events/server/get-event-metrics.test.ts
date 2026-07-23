import { describe, expect, it } from "vitest";

import {
  calculateAttendanceRate,
  computeCapacityUtilization,
} from "../event-metrics-policy";

describe("Event Metrics Calculations", () => {
  describe("calculateAttendanceRate", () => {
    it("returns 0% when confirmed registrations count is 0", () => {
      expect(calculateAttendanceRate({ confirmedCount: 0, activeCheckInsCount: 0 })).toBe(0);
      expect(calculateAttendanceRate({ confirmedCount: 0, activeCheckInsCount: 5 })).toBe(0);
    });

    it("calculates percentage accurately based on glossary definition", () => {
      // 50 check-ins out of 100 confirmed registrations = 50%
      expect(calculateAttendanceRate({ confirmedCount: 100, activeCheckInsCount: 50 })).toBe(50);
      // 1 out of 3 confirmed = 33.3% -> 33%
      expect(calculateAttendanceRate({ confirmedCount: 3, activeCheckInsCount: 1 })).toBe(33);
      // 100 out of 100 confirmed = 100%
      expect(calculateAttendanceRate({ confirmedCount: 100, activeCheckInsCount: 100 })).toBe(100);
    });
  });

  describe("computeCapacityUtilization", () => {
    it("sums confirmed registrations, active capacity holds, and active admission offers", () => {
      const result = computeCapacityUtilization({
        capacity: 100,
        confirmedCount: 40,
        activeHoldsCount: 10,
        activeOffersCount: 5,
      });

      expect(result.claimed).toBe(55);
      expect(result.remaining).toBe(45);
      expect(result.percentage).toBe(55);
    });

    it("handles zero capacity gracefully", () => {
      const result = computeCapacityUtilization({
        capacity: 0,
        confirmedCount: 0,
        activeHoldsCount: 0,
        activeOffersCount: 0,
      });

      expect(result.claimed).toBe(0);
      expect(result.remaining).toBe(0);
      expect(result.percentage).toBe(0);
    });
  });
});
