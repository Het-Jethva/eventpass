"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IconSearch } from "@tabler/icons-react";

import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  ROSTER_FILTERS,
  ROSTER_FILTER_LABELS,
  type RosterFilter,
} from "@/features/registration/roster-filters";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 250;

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(initialQuery);
  const isFirstRender = useRef(true);

  function buildHref(next: { query?: string; filter?: RosterFilter }) {
    const params = new URLSearchParams(searchParams.toString());

    const nextQuery = next.query ?? query;
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
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

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (query === initialQuery) return;

    const timer = setTimeout(() => {
      startTransition(() => router.replace(buildHref({ query })));
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // `buildHref` closes over the current params; recreating it each render is
    // cheaper than memoizing it and keeps the debounce keyed to the query alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, initialQuery, router]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative max-w-sm">
        <IconSearch
          aria-hidden="true"
          className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={query}
          onChange={(changeEvent) => setQuery(changeEvent.target.value)}
          placeholder="Search name or email"
          aria-label="Search Registrations by attendee name or email"
          className="pl-9"
        />
        {isPending ? (
          <Spinner className="absolute top-1/2 right-3 size-4 -translate-y-1/2" />
        ) : null}
      </div>

      <div
        className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label="Filter Registrations by status"
      >
        {ROSTER_FILTERS.map((filter) => {
          const isActive = filter === activeFilter;
          return (
            <button
              key={filter}
              type="button"
              aria-pressed={isActive}
              onClick={() =>
                startTransition(() => router.replace(buildHref({ filter })))
              }
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {ROSTER_FILTER_LABELS[filter]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
