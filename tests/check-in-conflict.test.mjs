import assert from "node:assert/strict";
import test from "node:test";

import { arbitrateCheckInConflict } from "../features/admission/check-in-conflict.ts";

const earlier = {
  id: "a",
  actorUserId: "first-scanner",
  attemptedAt: new Date("2030-01-01T10:01:00Z"),
  timestampConfidence: "high",
};
const later = {
  id: "b",
  actorUserId: "second-scanner",
  attemptedAt: new Date("2030-01-01T10:02:00Z"),
  timestampConfidence: "high",
};

test("a manual winner survives a later high-confidence submission", () => {
  const directive = arbitrateCheckInConflict({
    attempt: later,
    competing: [earlier],
    activeCheckIn: {
      id: "chosen-check-in",
      actorUserId: later.actorUserId,
      checkedInAt: later.attemptedAt,
    },
    currentConflictStatus: "resolved_manual",
  });
  assert.deepEqual(directive, {
    attemptOutcome: "duplicate",
    invalidateActiveCheckIn: false,
    createCheckInFor: null,
    linkAttemptToActiveCheckIn: false,
    ensureConflict: null,
  });
});

test("an unresolved conflict stays unresolved when no other device is included", () => {
  const directive = arbitrateCheckInConflict({
    attempt: later,
    competing: [],
    currentConflictStatus: "unresolved",
  });
  assert.equal(directive.attemptOutcome, "conflict");
  assert.equal(directive.createCheckInFor, null);
  assert.equal(directive.ensureConflict, null);
});

test("an earlier high-confidence attempt can still win automatic arbitration", () => {
  const directive = arbitrateCheckInConflict({
    attempt: earlier,
    competing: [later],
    activeCheckIn: {
      id: "later-check-in",
      actorUserId: later.actorUserId,
      checkedInAt: later.attemptedAt,
    },
    currentConflictStatus: "resolved_auto",
  });
  assert.equal(directive.attemptOutcome, "accepted");
  assert.equal(directive.invalidateActiveCheckIn, true);
  assert.deepEqual(directive.createCheckInFor, {
    actorUserId: earlier.actorUserId,
    checkedInAt: earlier.attemptedAt,
  });
  assert.deepEqual(directive.ensureConflict, {
    status: "resolved_auto",
    authoritativeScanAttemptId: earlier.id,
  });
});
