/**
 * Roster filter vocabulary, kept separate from the query so the client search
 * controls can import it without pulling Drizzle and `server-only` into the
 * browser bundle.
 */

export const ROSTER_FILTERS = [
  "all",
  "checked_in",
  "confirmed",
  "waitlisted",
  "unconfirmed",
  "expired",
  "canceled",
] as const;

export type RosterFilter = (typeof ROSTER_FILTERS)[number];

export const ROSTER_FILTER_LABELS: Record<RosterFilter, string> = {
  all: "All",
  checked_in: "Checked in",
  confirmed: "Confirmed",
  waitlisted: "Waitlisted",
  unconfirmed: "Unconfirmed",
  expired: "Expired",
  canceled: "Canceled",
};

export function parseRosterFilter(value: string | undefined): RosterFilter {
  return ROSTER_FILTERS.includes(value as RosterFilter)
    ? (value as RosterFilter)
    : "all";
}
