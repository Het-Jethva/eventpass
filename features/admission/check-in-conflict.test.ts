import { describe, expect, it } from "vitest";

import { arbitrateCheckInConflict } from "./check-in-conflict";

const early = new Date("2030-06-01T12:00:00.000Z");
const late = new Date("2030-06-01T12:05:00.000Z");

function attempt(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    actorUserId: "user-a",
    attemptedAt: early,
    timestampConfidence: "high" as const,
    ...overrides,
  };
}

describe("arbitrateCheckInConflict", () => {
  it("admits the attempt when nothing competes and nothing is checked in", () => {
    expect(
      arbitrateCheckInConflict({ attempt: attempt(), competing: [] }),
    ).toEqual({
      attemptOutcome: "accepted",
      invalidateActiveCheckIn: false,
      createCheckInFor: { actorUserId: "user-a", checkedInAt: early },
      linkAttemptToActiveCheckIn: false,
      ensureConflict: null,
    });
  });

  it("calls a lone attempt a duplicate when a Check-in already stands", () => {
    expect(
      arbitrateCheckInConflict({
        attempt: attempt(),
        competing: [],
        activeCheckIn: { id: "check-in", actorUserId: "user-a", checkedInAt: early },
      }),
    ).toMatchObject({ attemptOutcome: "duplicate", createCheckInFor: null });
  });

  it("lets the earliest high-confidence attempt win the race", () => {
    const directive = arbitrateCheckInConflict({
      attempt: attempt({ attemptedAt: late }),
      competing: [attempt({ id: "22222222-2222-2222-2222-222222222222", actorUserId: "user-b", attemptedAt: early })],
    });
    expect(directive.attemptOutcome).toBe("duplicate");
    expect(directive.createCheckInFor).toEqual({ actorUserId: "user-b", checkedInAt: early });
    expect(directive.ensureConflict).toEqual({ status: "resolved_auto", authoritativeScanAttemptId: "22222222-2222-2222-2222-222222222222" });
  });

  it("adopts the standing Check-in when it already names the winner", () => {
    const directive = arbitrateCheckInConflict({
      attempt: attempt(),
      competing: [attempt({ id: "22222222-2222-2222-2222-222222222222", attemptedAt: late })],
      activeCheckIn: { id: "check-in", actorUserId: "user-a", checkedInAt: early },
    });
    expect(directive).toMatchObject({
      attemptOutcome: "accepted",
      invalidateActiveCheckIn: false,
      createCheckInFor: null,
      linkAttemptToActiveCheckIn: true,
    });
  });

  it("replaces the standing Check-in when a competitor won earlier", () => {
    const directive = arbitrateCheckInConflict({
      attempt: attempt({ attemptedAt: late }),
      competing: [attempt({ id: "22222222-2222-2222-2222-222222222222", actorUserId: "user-b", attemptedAt: early })],
      activeCheckIn: { id: "check-in", actorUserId: "user-a", checkedInAt: late },
    });
    expect(directive).toMatchObject({
      attemptOutcome: "duplicate",
      invalidateActiveCheckIn: true,
    });
    expect(directive.createCheckInFor).toEqual({ actorUserId: "user-b", checkedInAt: early });
  });

  it("holds a low-confidence collision as a conflict for Organizer review", () => {
    const directive = arbitrateCheckInConflict({
      attempt: attempt({ timestampConfidence: "low" }),
      competing: [attempt({ id: "22222222-2222-2222-2222-222222222222" })],
      activeCheckIn: { id: "check-in", actorUserId: "user-a", checkedInAt: early },
    });
    expect(directive).toMatchObject({
      attemptOutcome: "conflict",
      invalidateActiveCheckIn: true,
      createCheckInFor: null,
      ensureConflict: { status: "unresolved" },
    });
  });

  it("does not reopen an already unresolved conflict row", () => {
    const directive = arbitrateCheckInConflict({
      attempt: attempt({ timestampConfidence: "low" }),
      competing: [attempt({ id: "22222222-2222-2222-2222-222222222222" })],
      currentConflictStatus: "unresolved",
    });
    expect(directive.ensureConflict).toBeNull();
    expect(directive.attemptOutcome).toBe("conflict");
  });

  it("calls a late low-confidence attempt a duplicate once settled", () => {
    expect(
      arbitrateCheckInConflict({
        attempt: attempt({ attemptedAt: late, timestampConfidence: "low" }),
        competing: [attempt({ id: "22222222-2222-2222-2222-222222222222" })],
        activeCheckIn: { id: "check-in", actorUserId: "user-b", checkedInAt: early },
        currentConflictStatus: "resolved_auto",
      }),
    ).toMatchObject({ attemptOutcome: "duplicate", ensureConflict: null });
  });
});
