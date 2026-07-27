import { describe, expect, it } from "vitest";

import {
  buildCheckInsTimeline,
  calculateAttendanceRate,
  computeCapacityUtilization,
} from "../event-metrics-policy";

describe("Event Metrics Calculations", () => {
  describe("buildCheckInsTimeline", () => {
    it("groups Check-ins into whole-hour buckets", () => {
      const result = buildCheckInsTimeline({
        checkIns: [
          { checkedInAt: new Date("2026-07-27T10:05:00Z") },
          { checkedInAt: new Date("2026-07-27T10:55:00Z") },
          { checkedInAt: new Date("2026-07-27T11:05:00Z") },
        ],
        timeZone: "UTC",
      });

      expect(result.length).toBe(2);
      expect(result[0]?.count).toBe(2);
      expect(result[1]?.count).toBe(1);
    });

    it("separates Event Time Zone hours across a half-hour UTC offset", () => {
      const result = buildCheckInsTimeline({
        checkIns: [
          { checkedInAt: new Date("2026-07-27T08:10:00Z") },
          { checkedInAt: new Date("2026-07-27T08:40:00Z") },
        ],
        timeZone: "Asia/Kolkata",
      });

      // 13:40 and 14:10 in the Event Time Zone belong to different hour buckets.
      expect(result.length).toBe(2);
      expect(result[0]?.count).toBe(1);
      expect(result[0]?.label).toBe("1 PM");
      expect(result[0]?.hourIso).toBe("2026-07-27T07:30:00.000Z");
      expect(result[1]?.count).toBe(1);
      expect(result[1]?.label).toBe("2 PM");
      expect(result[1]?.hourIso).toBe("2026-07-27T08:30:00.000Z");
    });

    it("labels whole-hour buckets without stray minutes", () => {
      const result = buildCheckInsTimeline({
        checkIns: [{ checkedInAt: new Date("2026-07-27T08:40:00Z") }],
        timeZone: "Asia/Kolkata",
      });

      expect(result.every(({ label }) => !label.includes(":"))).toBe(true);
    });

    it("returns no buckets when there are no Check-ins", () => {
      expect(buildCheckInsTimeline({ checkIns: [], timeZone: "UTC" }).length).toBe(0);
    });

    it("sorts buckets chronologically when Check-ins arrive in reverse order", () => {
      const result = buildCheckInsTimeline({
        checkIns: [
          { checkedInAt: new Date("2026-07-27T11:05:00Z") },
          { checkedInAt: new Date("2026-07-27T10:05:00Z") },
        ],
        timeZone: "UTC",
      });

      expect(result[0]?.hourIso).toBe("2026-07-27T10:00:00.000Z");
      expect(result[1]?.hourIso).toBe("2026-07-27T11:00:00.000Z");
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
