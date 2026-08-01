"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { SearchField, useDebouncedQuerySync } from "@/components/search-field";
import { SegmentedFilter } from "@/components/segmented-filter";
import {
  ROSTER_FILTERS,
  ROSTER_FILTER_LABELS,
  type RosterFilter,
} from "@/features/registration/roster-filters";

/**
 * Search and status filter for the roster, held in the URL so a view is
 * shareable and survives a reload.
 *
 * The input stays mounted and keeps its own value while the server refetches,
 * which is the whole reason the results sit behind their own Suspense boundary:
 * a route-level `loading.tsx` would replace this control mid-keystroke.
 */
export function RosterSearchControls({
  activeFilter,
  initialQuery,
}: {
  activeFilter: RosterFilter;
  initialQuery: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function buildHref(next: { query: string; filter?: RosterFilter }) {
    const params = new URLSearchParams(searchParams.toString());

    if (next.query.trim()) params.set("q", next.query.trim());
    else params.delete("q");

    const nextFilter = next.filter ?? activeFilter;
    if (nextFilter !== "all") params.set("status", nextFilter);
    else params.delete("status");

    // Any change to the result set invalidates the cursor: page two of the old
    // query has nothing to do with page one of the new one.
    params.delete("cursor");

    const search = params.toString();
    return search ? `${pathname}?${search}` : pathname;
  }

  const { query, setQuery, isPending, navigate } = useDebouncedQuerySync({
    initialQuery,
    buildHref: (nextQuery) => buildHref({ query: nextQuery }),
  });

  return (
    <div className="flex flex-col gap-3">
      <SearchField
        value={query}
        onChange={setQuery}
        pending={isPending}
        label="Search registrations by attendee name or email"
        placeholder="Search name or email"
      />

      <SegmentedFilter
        label="Filter registrations by status"
        value={activeFilter}
        options={ROSTER_FILTERS.map((filter) => ({
          value: filter,
          label: ROSTER_FILTER_LABELS[filter],
        }))}
        onSelect={(filter) =>
          navigate(buildHref({ query, filter: filter as RosterFilter }))
        }
      />
    </div>
  );
}
