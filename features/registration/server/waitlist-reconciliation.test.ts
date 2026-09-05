import { describe, expect, it } from "vitest";

import { getAdmissionOfferExpiry } from "./waitlist-reconciliation";

describe("Admission Offer deadline", () => {
  it("uses twelve hours when Registration stays open longer", () => {
    expect(
      getAdmissionOfferExpiry(
        new Date("2030-01-01T12:00:00.000Z"),
        new Date("2030-01-02T12:00:00.000Z"),
      ),
    ).toEqual(new Date("2030-01-02T00:00:00.000Z"));
  });

  it("uses Registration Window closure when it comes first", () => {
    expect(
      getAdmissionOfferExpiry(
        new Date("2030-01-01T12:00:00.000Z"),
        new Date("2030-01-01T18:00:00.000Z"),
      ),
    ).toEqual(new Date("2030-01-01T18:00:00.000Z"));
  });
});
