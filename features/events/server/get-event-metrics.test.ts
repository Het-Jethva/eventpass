import { describe, expect, it } from "vitest";

import {
  calculateAttendanceRate,
  computeCapacityUtilization,
  formatCheckInsTimeline,
} from "../event-metrics-policy";

describe("Event Metrics Calculations", () => {
  // Bucketing happens in SQL; the policy labels the buckets in the Event Time
  // Zone and carries the counts and instants through unchanged.
  describe("formatCheckInsTimeline", () => {
    it("labels Event Time Zone hours across a half-hour UTC offset", () => {
      const result = formatCheckInsTimeline({
        buckets: [
          { hourStart: new Date("2026-07-27T07:30:00Z"), count: 1 },
          { hourStart: new Date("2026-07-27T08:30:00Z"), count: 2 },
        ],
        timeZone: "Asia/Kolkata",
      });

      expect(result).toEqual([
        { label: "1 PM", hourIso: "2026-07-27T07:30:00.000Z", count: 1 },
        { label: "2 PM", hourIso: "2026-07-27T08:30:00.000Z", count: 2 },
      ]);
    });

    it("labels whole-hour buckets without stray minutes", () => {
      const result = formatCheckInsTimeline({
        buckets: [{ hourStart: new Date("2026-07-27T08:30:00Z"), count: 1 }],
        timeZone: "Asia/Kolkata",
      });

      expect(result.every(({ label }) => !label.includes(":"))).toBe(true);
    });

    it("disambiguates two buckets that share a local hour when clocks fall back", () => {
      // America/New_York leaves DST on 2026-11-01 at 06:00Z: 05:00Z and 06:00Z
      // both read as 1 AM on the wall clock.
      const result = formatCheckInsTimeline({
        buckets: [
          { hourStart: new Date("2026-11-01T05:00:00Z"), count: 3 },
          { hourStart: new Date("2026-11-01T06:00:00Z"), count: 4 },
        ],
        timeZone: "America/New_York",
      });

      expect(result[0]?.label).not.toBe(result[1]?.label);
      expect(result.map(({ count }) => count)).toEqual([3, 4]);
    });

    it("returns no points when there are no buckets", () => {
      expect(formatCheckInsTimeline({ buckets: [], timeZone: "UTC" })).toEqual([]);
    });
  });

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
