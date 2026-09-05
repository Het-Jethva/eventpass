import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../../../lib/db", () => ({ db: {} }));

import { createDraftEventInputSchema } from "./create-draft-event";

const validDraft = {
  name: "Map URL event",
  description: "Checks that venue map links cannot use non-http schemes.",
  slug: "map-url-event",
  eventTimeZone: "UTC",
  startsAtLocal: "2030-01-02T12:00",
  endsAtLocal: "2030-01-02T14:00",
  venueName: "Main hall",
  venueAddress: "University Road",
  venueMapUrl: "",
  capacity: 10,
  registrationOpensAtLocal: "2029-12-01T00:00",
  registrationClosesAtLocal: "2030-01-02T12:00",
  checkInOpensAtLocal: "2030-01-02T11:00",
  checkInClosesAtLocal: "2030-01-02T14:00",
};

describe("Draft Event map URLs", () => {
  it("accepts an empty map URL or an http(s) link", () => {
    expect(createDraftEventInputSchema.parse(validDraft).venueMapUrl).toBeNull();
    expect(
      createDraftEventInputSchema.parse({
        ...validDraft,
        venueMapUrl: "https://maps.example.com/venue",
      }).venueMapUrl,
    ).toBe("https://maps.example.com/venue");
  });

  it("rejects javascript and other non-http map URLs", () => {
    expect(
      createDraftEventInputSchema.safeParse({
        ...validDraft,
        venueMapUrl: "javascript:alert(1)",
      }).success,
    ).toBe(false);
    expect(
      createDraftEventInputSchema.safeParse({
        ...validDraft,
        venueMapUrl: "ftp://maps.example.com/venue",
      }).success,
    ).toBe(false);
  });
});
