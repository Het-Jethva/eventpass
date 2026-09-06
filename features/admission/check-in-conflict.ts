/**
 * Check-in Conflict arbitration, owned once. When Provisional Check-ins for
 * the same Ticket synchronize from different offline devices, the earliest
 * high-confidence attempt becomes the Check-in on its own; low-confidence
 * collisions need a reasoned Organizer selection and stay visible as a
 * conflict. See ADR 0001.
 *
 * The arbiter answers what should happen as plain data. The synchronization
 * loop executes the directive: invalidating and creating Check-ins,
 * ensuring the conflict row, and storing the Scan Attempt. No database, no
 * clock, no keys cross this seam.
 */

export type ArbitrationAttempt = {
  id: string;
  actorUserId: string;
  attemptedAt: Date;
  /**
   * Only "low" diverts to Organizer review. Anything else — "high" or an
   * older attempt recorded without a confidence — races on time.
   */
  timestampConfidence: string | null;
};

export type ArbitrationCheckIn = {
  id: string;
  actorUserId: string;
  checkedInAt: Date;
};

export type ArbitrationDirective = {
  attemptOutcome: "accepted" | "duplicate" | "conflict";
  invalidateActiveCheckIn: boolean;
  /** Create a Check-in for the winner. Null when none is needed. */
  createCheckInFor: { actorUserId: string; checkedInAt: Date } | null;
  /** Link the stored attempt to the still-active Check-in. */
  linkAttemptToActiveCheckIn: boolean;
  ensureConflict:
    | null
    | { status: "unresolved" }
    | { status: "resolved_auto"; authoritativeScanAttemptId: string };
};

function sameAttemptId(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}

function earliestFirst(
  left: ArbitrationAttempt,
  right: ArbitrationAttempt,
): number {
  return (
    left.attemptedAt.getTime() - right.attemptedAt.getTime() ||
    (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
  );
}

export function arbitrateCheckInConflict(values: {
  attempt: ArbitrationAttempt;
  /** Provisional Check-ins for the same Ticket from other devices. */
  competing: ArbitrationAttempt[];
  activeCheckIn?: ArbitrationCheckIn;
  currentConflictStatus?: string;
}): ArbitrationDirective {
  const { attempt, competing, activeCheckIn, currentConflictStatus } = values;
  const settled =
    Boolean(activeCheckIn) &&
    (currentConflictStatus === "resolved_auto" ||
      currentConflictStatus === "resolved_manual");

  if (competing.length === 0) {
    if (activeCheckIn) {
      return {
        attemptOutcome: "duplicate",
        invalidateActiveCheckIn: false,
        createCheckInFor: null,
        linkAttemptToActiveCheckIn: false,
        ensureConflict: null,
      };
    }
    return {
      attemptOutcome: "accepted",
      invalidateActiveCheckIn: false,
      createCheckInFor: {
        actorUserId: attempt.actorUserId,
        checkedInAt: attempt.attemptedAt,
      },
      linkAttemptToActiveCheckIn: false,
      ensureConflict: null,
    };
  }

  const hasLowConfidence =
    attempt.timestampConfidence === "low" ||
    competing.some(
      (candidate) => candidate.timestampConfidence === "low",
    );
  if (hasLowConfidence && settled) {
    return {
      attemptOutcome: "duplicate",
      invalidateActiveCheckIn: false,
      createCheckInFor: null,
      linkAttemptToActiveCheckIn: false,
      ensureConflict: null,
    };
  }
  if (hasLowConfidence) {
    return {
      attemptOutcome: "conflict",
      invalidateActiveCheckIn: Boolean(activeCheckIn),
      createCheckInFor: null,
      linkAttemptToActiveCheckIn: false,
      ensureConflict:
        !currentConflictStatus || currentConflictStatus !== "unresolved"
          ? { status: "unresolved" }
          : null,
    };
  }

  const winner = [...competing, attempt].sort(earliestFirst)[0]!;
  const winnerIsAttempt = sameAttemptId(winner.id, attempt.id);
  const adoptActiveCheckIn =
    Boolean(activeCheckIn) &&
    activeCheckIn!.actorUserId === winner.actorUserId &&
    activeCheckIn!.checkedInAt.getTime() === winner.attemptedAt.getTime();
  return {
    attemptOutcome: winnerIsAttempt ? "accepted" : "duplicate",
    invalidateActiveCheckIn: Boolean(activeCheckIn) && !adoptActiveCheckIn,
    createCheckInFor: adoptActiveCheckIn
      ? null
      : { actorUserId: winner.actorUserId, checkedInAt: winner.attemptedAt },
    linkAttemptToActiveCheckIn: adoptActiveCheckIn,
    ensureConflict: {
      status: "resolved_auto",
      authoritativeScanAttemptId: winner.id,
    },
  };
}
