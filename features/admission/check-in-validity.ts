import type { OfflineTicketValidityState } from "./offline-snapshot";

/**
 * The Check-in validity ladder, owned once. Online admission, offline
 * admission, offline synchronization, and snapshot preparation each resolve
 * "is this Ticket admissible right now?" from what they know: a full
 * database row, a snapshot row, or a collapsed validity state. The ordering
 * below is the whole rule: canceled beats replaced beats expired beats the
 * Check-in Window beats the duplicate Check-in test. Callers keep
 * resolution (unknown Tickets, revoked Scanner Authorization) and
 * persistence (Scan Attempts, Check-ins, conflicts); only the validity
 * decision lives here, as a pure truth table.
 */

export type TicketValidityStatuses = {
  eventStatus: string;
  registrationStatus: string;
  ticketStatus: string;
};

export type ValidityRefusal =
  | "invalid"
  | "canceled"
  | "replaced"
  | "expired"
  | "outside_window";

export type ValidityDecision =
  | { verdict: "admit" }
  | { verdict: "refuse"; reason: ValidityRefusal };

/**
 * Collapse a Ticket row to the validity carried in the Offline Event
 * Snapshot. Snapshot preparation calls this; offline admission reads the
 * stored result, never the row.
 */
export function resolveSnapshotValidityState(
  values: TicketValidityStatuses,
): OfflineTicketValidityState {
  if (
    values.eventStatus === "canceled" ||
    values.registrationStatus === "canceled" ||
    values.ticketStatus === "canceled"
  ) {
    return "canceled";
  }
  if (values.registrationStatus === "expired") return "expired";
  if (values.ticketStatus === "replaced") return "replaced";
  return "active";
}

export function decideTicketValidity(values: {
  statuses: TicketValidityStatuses;
  /** The stored Ticket credential verifies for this Event and Ticket. */
  credentialValid: boolean;
  attemptedAt: Date;
  checkInOpensAt: Date;
  checkInClosesAt: Date;
  /** An Organizer admitting with a reason inside the transaction. */
  canOverrideWindow: boolean;
}): ValidityDecision {
  const { statuses } = values;
  if (!values.credentialValid || statuses.eventStatus === "draft") {
    return { verdict: "refuse", reason: "invalid" };
  }
  if (
    statuses.eventStatus === "canceled" ||
    statuses.registrationStatus === "canceled" ||
    statuses.ticketStatus === "canceled"
  ) {
    return { verdict: "refuse", reason: "canceled" };
  }
  if (statuses.registrationStatus === "expired") {
    return { verdict: "refuse", reason: "expired" };
  }
  if (statuses.registrationStatus !== "confirmed") {
    return { verdict: "refuse", reason: "invalid" };
  }
  if (statuses.ticketStatus === "replaced") {
    return { verdict: "refuse", reason: "replaced" };
  }
  if (
    values.attemptedAt >= values.checkInClosesAt &&
    !values.canOverrideWindow
  ) {
    return { verdict: "refuse", reason: "expired" };
  }
  if (
    values.attemptedAt < values.checkInOpensAt &&
    !values.canOverrideWindow
  ) {
    return { verdict: "refuse", reason: "outside_window" };
  }
  return { verdict: "admit" };
}

/**
 * Snapshot-relative validity for an offline device: the snapshot already
 * collapsed the row to a validity state, so only that state and the
 * Check-in Window remain. Returns null when the device must proceed to the
 * duplicate Check-in test. There is no window override offline.
 */
export function decideSnapshotTicketOutcome(values: {
  validityState: OfflineTicketValidityState;
  attemptedAt: Date;
  checkInOpensAt: Date;
  checkInClosesAt: Date;
}): ValidityRefusal | null {
  if (values.validityState === "canceled") return "canceled";
  if (values.validityState === "replaced") return "replaced";
  if (values.validityState === "expired") return "expired";
  if (values.attemptedAt >= values.checkInClosesAt) return "expired";
  if (values.attemptedAt < values.checkInOpensAt) return "outside_window";
  return null;
}
