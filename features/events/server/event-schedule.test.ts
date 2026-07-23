import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  isIanaTimeZone,
  localDateTimeInTimeZoneToUtc,
  utcToLocalDateTimeInput,
} from "./event-schedule";

describe("Event Schedule Timezone Utilities", () => {
  describe("isIanaTimeZone", () => {
    it("returns true for valid IANA timezones", () => {
      expect(isIanaTimeZone("UTC")).toBe(true);
      expect(isIanaTimeZone("America/New_York")).toBe(true);
      expect(isIanaTimeZone("Asia/Tokyo")).toBe(true);
      expect(isIanaTimeZone("Europe/London")).toBe(true);
    });

    it("returns false for invalid timezone strings", () => {
      expect(isIanaTimeZone("Invalid/Timezone")).toBe(false);
      expect(isIanaTimeZone("Not/A_Zone")).toBe(false);
      expect(isIanaTimeZone("")).toBe(false);
    });
  });

  describe("utcToLocalDateTimeInput", () => {
    it("formats UTC date to local datetime input string for valid timezone", () => {
      const date = new Date("2026-06-15T14:30:00.000Z");
      expect(utcToLocalDateTimeInput(date, "UTC")).toBe("2026-06-15T14:30");
    });

    it("handles invalid timezone input gracefully without throwing RangeError, falling back to UTC", () => {
      const date = new Date("2026-06-15T14:30:00.000Z");
      expect(() => utcToLocalDateTimeInput(date, "Invalid/Timezone")).not.toThrow();
      expect(utcToLocalDateTimeInput(date, "Invalid/Timezone")).toBe("2026-06-15T14:30");
    });
  });

  describe("localDateTimeInTimeZoneToUtc", () => {
    it("converts local date time string in valid timezone to UTC Date", () => {
      const result = localDateTimeInTimeZoneToUtc("2026-06-15T14:30", "UTC");
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe("2026-06-15T14:30:00.000Z");
    });

    it("returns null for invalid timezone string", () => {
      const result = localDateTimeInTimeZoneToUtc("2026-06-15T14:30", "Invalid/Timezone");
      expect(result).toBeNull();
    });
  });
});
