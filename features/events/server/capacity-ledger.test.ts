import { describe, expect, it } from "vitest";

import {
  decreaseDisplacesClaims,
  getAdmissionOfferExpiry,
  hasCapacityForNewClaim,
  type ActiveCapacityUsage,
} from "./capacity-ledger";

function usage(overrides: Partial<ActiveCapacityUsage> = {}): ActiveCapacityUsage {
  const confirmed = overrides.confirmed ?? 0;
  const holds = overrides.holds ?? 0;
  const offers = overrides.offers ?? 0;
  return {
    confirmed,
    holds,
    offers,
    claimed: overrides.claimed ?? confirmed + holds + offers,
  };
}

describe("Capacity ledger", () => {
  it("counts confirmed Registrations, Capacity Holds, and Admission Offers together", () => {
    expect(hasCapacityForNewClaim(usage({ confirmed: 8, holds: 1, offers: 1 }), 10)).toBe(false);
    expect(hasCapacityForNewClaim(usage({ confirmed: 8, holds: 1 }), 10)).toBe(true);
  });

  it("treats a full Event as having no place for a new claim", () => {
    expect(hasCapacityForNewClaim(usage({ confirmed: 10 }), 10)).toBe(false);
    expect(hasCapacityForNewClaim(usage({ confirmed: 9 }), 10)).toBe(true);
  });

  it("rejects a decrease that would displace an existing claim", () => {
    expect(decreaseDisplacesClaims(10, 9)).toBe(true);
    expect(decreaseDisplacesClaims(10, 10)).toBe(false);
    expect(decreaseDisplacesClaims(10, 11)).toBe(false);
  });

  it("expires an Admission Offer twelve hours after issuance", () => {
    expect(
      getAdmissionOfferExpiry(
        new Date("2030-01-01T12:00:00.000Z"),
        new Date("2030-01-02T12:00:00.000Z"),
      ),
    ).toEqual(new Date("2030-01-02T00:00:00.000Z"));
  });

  it("clamps an Admission Offer to Registration Window closure", () => {
    expect(
      getAdmissionOfferExpiry(
        new Date("2030-01-01T12:00:00.000Z"),
        new Date("2030-01-01T18:00:00.000Z"),
      ),
    ).toEqual(new Date("2030-01-01T18:00:00.000Z"));
  });
});
