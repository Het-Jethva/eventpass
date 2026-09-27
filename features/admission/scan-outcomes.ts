export const STORED_SCAN_OUTCOMES = [
  "accepted",
  "duplicate",
  "invalid",
  "unknown",
  "canceled",
  "replaced",
  "expired",
  "outside_window",
  "conflict",
  "not_checked_in",
] as const;

export type StoredScanOutcome = (typeof STORED_SCAN_OUTCOMES)[number];
