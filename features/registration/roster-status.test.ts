import { describe, expect, it } from "vitest";

import {
  resolveRosterStatus,
  type RosterStatusInput,
} from "./roster-status";

const NOW = new Date("2026-07-30T12:00:00.000Z");

function input(overrides: Partial<RosterStatusInput> = {}): RosterStatusInput {
  return {
    registrationStatus: "confirmed",
    ticketStatus: "active",
    hasActiveCheckIn: false,
    hasReversedCheckIn: false,
    capacityHold: null,
    admissionOffer: null,
    ...overrides,
  };
}

describe("resolveRosterStatus", () => {
  it("reports a confirmed Registration with an active Ticket and no qualifier", () => {
    const status = resolveRosterStatus(input(), NOW);

    expect(status.key).toBe("confirmed");
    expect(status.label).toBe("Confirmed");
    expect(status.qualifier).toBeNull();
    expect(status.deadline).toBeNull();
  });

  it("reports Checked in once a Check-in is active", () => {
    const status = resolveRosterStatus(input({ hasActiveCheckIn: true }), NOW);

    expect(status.key).toBe("checked_in");
    expect(status.label).toBe("Checked in");
  });

  it("keeps a replaced Ticket visible behind an active Check-in", () => {
    const status = resolveRosterStatus(
      input({ hasActiveCheckIn: true, ticketStatus: "replaced" }),
      NOW,
    );

    // Admission already happened, so Checked in still wins the label — but a
    // volunteer holding a stale Ticket needs the qualifier.
    expect(status.key).toBe("checked_in");
    expect(status.qualifier).toBe("Ticket replaced");
  });

  it("distinguishes a confirmed Registration whose Ticket was replaced", () => {
    const status = resolveRosterStatus(input({ ticketStatus: "replaced" }), NOW);

    expect(status.key).toBe("confirmed");
    expect(status.qualifier).toBe("Ticket replaced");
  });

  it("flags a confirmed Registration that never received a Ticket", () => {
    const status = resolveRosterStatus(input({ ticketStatus: null }), NOW);

    expect(status.qualifier).toBe("No Ticket issued");
  });

  it("surfaces a reversed Check-in when the Ticket is otherwise healthy", () => {
    const status = resolveRosterStatus(
      input({ hasReversedCheckIn: true }),
      NOW,
    );

    expect(status.key).toBe("confirmed");
    expect(status.qualifier).toBe("Check-in reversed");
  });

  it("prefers a Ticket problem over a reversed Check-in as the qualifier", () => {
    const status = resolveRosterStatus(
      input({ hasReversedCheckIn: true, ticketStatus: "canceled" }),
      NOW,
    );

    expect(status.qualifier).toBe("Ticket canceled");
  });

  it("carries the Capacity Hold deadline while the Hold is live", () => {
    const expiresAt = new Date("2026-07-30T12:11:00.000Z");
    const status = resolveRosterStatus(
      input({
        registrationStatus: "unconfirmed",
        ticketStatus: null,
        capacityHold: { expiresAt, claimedAt: null },
      }),
      NOW,
    );

    expect(status.key).toBe("unconfirmed");
    expect(status.qualifier).toBeNull();
    expect(status.deadline).toEqual({ kind: "capacity_hold", at: expiresAt });
  });

  it("reports an expired Capacity Hold instead of a running deadline", () => {
    const status = resolveRosterStatus(
      input({
        registrationStatus: "unconfirmed",
        ticketStatus: null,
        capacityHold: {
          expiresAt: new Date("2026-07-30T11:45:00.000Z"),
          claimedAt: null,
        },
      }),
      NOW,
    );

    expect(status.qualifier).toBe("Capacity Hold expired");
    expect(status.deadline).toBeNull();
  });

  it("treats a Hold expiring exactly now as no longer live", () => {
    const status = resolveRosterStatus(
      input({
        registrationStatus: "unconfirmed",
        ticketStatus: null,
        capacityHold: { expiresAt: NOW, claimedAt: null },
      }),
      NOW,
    );

    expect(status.qualifier).toBe("Capacity Hold expired");
    expect(status.deadline).toBeNull();
  });

  it("treats a claimed Hold as not live", () => {
    const status = resolveRosterStatus(
      input({
        registrationStatus: "unconfirmed",
        ticketStatus: null,
        capacityHold: {
          expiresAt: new Date("2026-07-30T12:11:00.000Z"),
          claimedAt: new Date("2026-07-30T11:50:00.000Z"),
        },
      }),
      NOW,
    );

    expect(status.deadline).toBeNull();
  });

  it("ranks a live Admission Offer above the Waitlist Entry behind it", () => {
    const expiresAt = new Date("2026-07-30T20:00:00.000Z");
    const status = resolveRosterStatus(
      input({
        registrationStatus: "waitlisted",
        ticketStatus: null,
        admissionOffer: { status: "active", expiresAt },
      }),
      NOW,
    );

    expect(status.key).toBe("offer_sent");
    expect(status.label).toBe("Admission Offer sent");
    expect(status.deadline).toEqual({ kind: "admission_offer", at: expiresAt });
  });

  it("falls back to Waitlisted once the Offer has lapsed", () => {
    const status = resolveRosterStatus(
      input({
        registrationStatus: "waitlisted",
        ticketStatus: null,
        admissionOffer: {
          status: "active",
          expiresAt: new Date("2026-07-30T11:00:00.000Z"),
        },
      }),
      NOW,
    );

    // The row is stale rather than wrong: the Offer's own status has not caught
    // up yet, so the deadline decides.
    expect(status.key).toBe("waitlisted");
    expect(status.qualifier).toBe("Admission Offer expired");
  });

  it("reports a plain Waitlist Entry with no Offer", () => {
    const status = resolveRosterStatus(
      input({ registrationStatus: "waitlisted", ticketStatus: null }),
      NOW,
    );

    expect(status.key).toBe("waitlisted");
    expect(status.qualifier).toBeNull();
  });

  it("names which deadline lapsed for an expired Registration", () => {
    const fromHold = resolveRosterStatus(
      input({ registrationStatus: "expired", ticketStatus: null }),
      NOW,
    );
    const fromOffer = resolveRosterStatus(
      input({
        registrationStatus: "expired",
        ticketStatus: null,
        admissionOffer: {
          status: "expired",
          expiresAt: new Date("2026-07-29T12:00:00.000Z"),
        },
      }),
      NOW,
    );

    expect(fromHold.qualifier).toBe("Capacity Hold not claimed");
    expect(fromOffer.qualifier).toBe("Admission Offer not claimed");
  });

  it("lets Canceled override an active Check-in, but keeps it visible", () => {
    const status = resolveRosterStatus(
      input({
        registrationStatus: "canceled",
        ticketStatus: "canceled",
        hasActiveCheckIn: true,
      }),
      NOW,
    );

    expect(status.key).toBe("canceled");
    expect(status.qualifier).toBe("Checked in before cancellation");
  });

  it("reserves destructive emphasis for cancellation", () => {
    const canceled = resolveRosterStatus(
      input({ registrationStatus: "canceled", ticketStatus: "canceled" }),
      NOW,
    );

    expect(canceled.emphasis).toBe("destructive");

    for (const registrationStatus of [
      "confirmed",
      "waitlisted",
      "unconfirmed",
      "expired",
    ] as const) {
      const status = resolveRosterStatus(input({ registrationStatus }), NOW);
      expect(status.emphasis).not.toBe("destructive");
    }
  });

  it("gives every state a distinct label so colour is never load-bearing", () => {
    const labels = [
      resolveRosterStatus(input({ registrationStatus: "canceled" }), NOW),
      resolveRosterStatus(input({ hasActiveCheckIn: true }), NOW),
      resolveRosterStatus(input(), NOW),
      resolveRosterStatus(
        input({
          registrationStatus: "waitlisted",
          admissionOffer: {
            status: "active",
            expiresAt: new Date("2026-07-30T20:00:00.000Z"),
          },
        }),
        NOW,
      ),
      resolveRosterStatus(input({ registrationStatus: "waitlisted" }), NOW),
      resolveRosterStatus(input({ registrationStatus: "unconfirmed" }), NOW),
      resolveRosterStatus(input({ registrationStatus: "expired" }), NOW),
    ].map((status) => status.label);

    expect(new Set(labels).size).toBe(labels.length);
  });
});
