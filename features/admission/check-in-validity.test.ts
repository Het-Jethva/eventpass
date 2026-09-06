import { describe, expect, it } from "vitest";

import {
  decideSnapshotTicketOutcome,
  decideTicketValidity,
  resolveSnapshotValidityState,
} from "./check-in-validity";

const opensAt = new Date("2030-06-01T08:00:00.000Z");
const closesAt = new Date("2030-06-01T18:00:00.000Z");
const withinWindow = new Date("2030-06-01T12:00:00.000Z");

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    statuses: {
      eventStatus: "published",
      registrationStatus: "confirmed",
      ticketStatus: "active",
    },
    credentialValid: true,
    attemptedAt: withinWindow,
    checkInOpensAt: opensAt,
    checkInClosesAt: closesAt,
    canOverrideWindow: false,
    ...overrides,
  };
}

describe("decideTicketValidity", () => {
  it("admits a valid Ticket inside the Check-in Window", () => {
    expect(decideTicketValidity(validInput())).toEqual({ verdict: "admit" });
  });

  it("refuses a forged credential before any other rule", () => {
    expect(
      decideTicketValidity(
        validInput({
          credentialValid: false,
          statuses: {
            eventStatus: "canceled",
            registrationStatus: "canceled",
            ticketStatus: "canceled",
          },
        }),
      ),
    ).toEqual({ verdict: "refuse", reason: "invalid" });
  });

  it("orders canceled before expired before the window", () => {
    expect(
      decideTicketValidity(
        validInput({ statuses: { eventStatus: "canceled", registrationStatus: "expired", ticketStatus: "active" } }),
      ),
    ).toEqual({ verdict: "refuse", reason: "canceled" });
    expect(
      decideTicketValidity(
        validInput({ statuses: { eventStatus: "published", registrationStatus: "expired", ticketStatus: "active" }, attemptedAt: new Date("2030-06-02T00:00:00.000Z") }),
      ),
    ).toEqual({ verdict: "refuse", reason: "expired" });
  });

  it("refuses a Draft Event as invalid", () => {
    expect(
      decideTicketValidity(
        validInput({ statuses: { eventStatus: "draft", registrationStatus: "confirmed", ticketStatus: "active" } }),
      ),
    ).toEqual({ verdict: "refuse", reason: "invalid" });
  });

  it("refuses an unconfirmed Registration as invalid", () => {
    expect(
      decideTicketValidity(
        validInput({ statuses: { eventStatus: "published", registrationStatus: "waitlisted", ticketStatus: "active" } }),
      ),
    ).toEqual({ verdict: "refuse", reason: "invalid" });
  });

  it("refuses a replaced Ticket", () => {
    expect(
      decideTicketValidity(
        validInput({ statuses: { eventStatus: "published", registrationStatus: "confirmed", ticketStatus: "replaced" } }),
      ),
    ).toEqual({ verdict: "refuse", reason: "replaced" });
  });

  it("distinguishes past-close from before-open", () => {
    expect(
      decideTicketValidity(validInput({ attemptedAt: new Date("2030-06-01T19:00:00.000Z") })),
    ).toEqual({ verdict: "refuse", reason: "expired" });
    expect(
      decideTicketValidity(validInput({ attemptedAt: new Date("2030-06-01T07:00:00.000Z") })),
    ).toEqual({ verdict: "refuse", reason: "outside_window" });
  });

  it("lets an Organizer override either window edge with a reason", () => {
    expect(
      decideTicketValidity(validInput({ attemptedAt: new Date("2030-06-01T19:00:00.000Z"), canOverrideWindow: true })),
    ).toEqual({ verdict: "admit" });
    expect(
      decideTicketValidity(validInput({ attemptedAt: new Date("2030-06-01T07:00:00.000Z"), canOverrideWindow: true })),
    ).toEqual({ verdict: "admit" });
  });

  it("never lets an override rescue a canceled Ticket", () => {
    expect(
      decideTicketValidity(
        validInput({
          statuses: { eventStatus: "published", registrationStatus: "confirmed", ticketStatus: "canceled" },
          attemptedAt: new Date("2030-06-01T19:00:00.000Z"),
          canOverrideWindow: true,
        }),
      ),
    ).toEqual({ verdict: "refuse", reason: "canceled" });
  });
});

describe("snapshot validity", () => {
  it("collapses any canceled row to a canceled snapshot state", () => {
    expect(
      resolveSnapshotValidityState({ eventStatus: "canceled", registrationStatus: "confirmed", ticketStatus: "active" }),
    ).toBe("canceled");
    expect(
      resolveSnapshotValidityState({ eventStatus: "published", registrationStatus: "confirmed", ticketStatus: "replaced" }),
    ).toBe("replaced");
    expect(
      resolveSnapshotValidityState({ eventStatus: "published", registrationStatus: "expired", ticketStatus: "active" }),
    ).toBe("expired");
    expect(
      resolveSnapshotValidityState({ eventStatus: "published", registrationStatus: "confirmed", ticketStatus: "active" }),
    ).toBe("active");
  });

  it("keeps the snapshot ladder to state plus window", () => {
    expect(
      decideSnapshotTicketOutcome({ validityState: "active", attemptedAt: withinWindow, checkInOpensAt: opensAt, checkInClosesAt: closesAt }),
    ).toBeNull();
    expect(
      decideSnapshotTicketOutcome({ validityState: "replaced", attemptedAt: withinWindow, checkInOpensAt: opensAt, checkInClosesAt: closesAt }),
    ).toBe("replaced");
    expect(
      decideSnapshotTicketOutcome({ validityState: "active", attemptedAt: new Date("2030-06-01T19:00:00.000Z"), checkInOpensAt: opensAt, checkInClosesAt: closesAt }),
    ).toBe("expired");
    expect(
      decideSnapshotTicketOutcome({ validityState: "active", attemptedAt: new Date("2030-06-01T07:00:00.000Z"), checkInOpensAt: opensAt, checkInClosesAt: closesAt }),
    ).toBe("outside_window");
  });
});
