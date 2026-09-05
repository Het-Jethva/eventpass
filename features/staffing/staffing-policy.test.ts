import { describe, expect, it } from "vitest";

import {
  canManageRole,
  scannerExitPath,
  staffEventHomePath,
} from "./staffing-policy";

describe("Event Staff authorization policy", () => {
  it("reserves Organizer management for the Event Owner", () => {
    expect(canManageRole("owner", "organizer")).toBe(true);
    expect(canManageRole("organizer", "organizer")).toBe(false);
    expect(canManageRole("check_in_volunteer", "organizer")).toBe(false);
  });

  it("lets the Event Owner and Organizers manage Check-in Volunteers", () => {
    expect(canManageRole("owner", "check_in_volunteer")).toBe(true);
    expect(canManageRole("organizer", "check_in_volunteer")).toBe(true);
    expect(canManageRole("check_in_volunteer", "check_in_volunteer")).toBe(false);
  });

  it("sends Check-in Volunteers to the scanner, not the Organizer workspace", () => {
    const eventId = "11111111-1111-4111-8111-111111111111";
    expect(staffEventHomePath("owner", eventId)).toBe(`/events/${eventId}`);
    expect(staffEventHomePath("organizer", eventId)).toBe(`/events/${eventId}`);
    expect(staffEventHomePath("check_in_volunteer", eventId)).toBe(
      `/scanner/${eventId}`,
    );
    expect(scannerExitPath("owner", eventId)).toBe(`/events/${eventId}`);
    expect(scannerExitPath("organizer", eventId)).toBe(`/events/${eventId}`);
    expect(scannerExitPath("check_in_volunteer", eventId)).toBe("/events");
  });
});
