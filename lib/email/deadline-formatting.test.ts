import { describe, expect, it } from "vitest";

import { formatAdmissionOfferDeadline } from "./send-admission-offer";
import { displayMaterialChangeValue } from "./send-event-notification";
import { formatEventRange } from "./send-ticket";

// Two regressions live here. Offer and change emails once formatted every
// instant in UTC while the Ticket email used the Event Time Zone; and all
// three combined `dateStyle`/`timeStyle` with `timeZoneName`, which ECMA-402
// rejects with a TypeError, so the email threw before it was sent.
describe("Ticket email schedule", () => {
  it("formats the Event range in the Event Time Zone without throwing", () => {
    const range = formatEventRange(
      new Date("2026-03-14T04:30:00.000Z"),
      new Date("2026-03-14T06:30:00.000Z"),
      "Asia/Kolkata",
    );

    expect(range).toMatch(/10:00\sAM/);
    expect(range).toMatch(/12:00\sPM/);
    expect(range).toContain("GMT+5:30");
  });
});

describe("Admission Offer deadline", () => {
  it("is stated in the Event Time Zone", () => {
    const deadline = formatAdmissionOfferDeadline(
      new Date("2026-03-14T12:30:00.000Z"),
      "Asia/Kolkata",
    );

    expect(deadline).toMatch(/6:00\sPM/);
    expect(deadline).toContain("GMT+5:30");
    expect(deadline).not.toContain("UTC");
  });
});

describe("Material Event Change values", () => {
  it("renders instants in the Event Time Zone", () => {
    const rendered = displayMaterialChangeValue(
      "2026-03-14T12:30:00.000Z",
      "America/New_York",
    );

    expect(rendered).toMatch(/8:30\sAM/);
    expect(rendered).toContain("EDT");
  });

  it("leaves non-instant values alone", () => {
    expect(displayMaterialChangeValue(null, "UTC")).toBe("Not set");
    expect(displayMaterialChangeValue("", "UTC")).toBe("Not set");
    expect(displayMaterialChangeValue(1200, "UTC")).toBe("1,200");
    expect(displayMaterialChangeValue("Main Hall", "UTC")).toBe("Main Hall");
  });
});
