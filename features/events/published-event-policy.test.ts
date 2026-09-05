import { describe, expect, it } from "vitest";

import {
  assertPostCheckInChangeAllowed,
  PublishedEventChangeError,
} from "./published-event-policy";

const current = {
  role: "owner",
  name: "Engineering showcase",
  description: "A production Event.",
  eventTimeZone: "UTC",
  startsAt: new Date("2030-01-02T12:00:00.000Z"),
  endsAt: new Date("2030-01-02T14:00:00.000Z"),
  venueName: "Main hall",
  venueAddress: "University Road",
  venueMapUrl: null,
  capacity: 100,
  registrationOpensAt: new Date("2029-12-01T00:00:00.000Z"),
  registrationClosesAt: new Date("2030-01-02T12:00:00.000Z"),
  checkInOpensAt: new Date("2030-01-02T11:00:00.000Z"),
  checkInClosesAt: new Date("2030-01-02T14:00:00.000Z"),
};

function next(overrides: Partial<typeof current> = {}) {
  return { ...current, ...overrides };
}

describe("Published Event post-check-in policy", () => {
  it("lets only the Event Owner extend the Event end and Check-in close", () => {
    expect(() =>
      assertPostCheckInChangeAllowed(
        current,
        next({
          endsAt: new Date("2030-01-02T15:00:00.000Z"),
          checkInClosesAt: new Date("2030-01-02T15:00:00.000Z"),
        }),
      ),
    ).not.toThrow();

    expect(() =>
      assertPostCheckInChangeAllowed(
        { ...current, role: "organizer" },
        next({ endsAt: new Date("2030-01-02T15:00:00.000Z") }),
      ),
    ).toThrow(PublishedEventChangeError);
  });

  it("refuses reductions and unrelated Material Event Changes", () => {
    expect(() =>
      assertPostCheckInChangeAllowed(
        current,
        next({ checkInClosesAt: new Date("2030-01-02T13:30:00.000Z") }),
      ),
    ).toThrow(PublishedEventChangeError);
    expect(() =>
      assertPostCheckInChangeAllowed(
        current,
        next({ venueName: "Replacement hall" }),
      ),
    ).toThrow(PublishedEventChangeError);
  });
});
