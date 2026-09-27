"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { SearchField, useDebouncedQuerySync } from "@/components/search-field";

/**
 * Name search for the active check-ins list, held in the URL so the query
 * survives the page reload a reversal triggers.
 */
export function ActiveCheckInSearch({ initialQuery }: { initialQuery: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function buildHref(nextQuery: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    else params.delete("q");
    // Stale notices belong to the previous action, not this search.
    params.delete("notice");
    params.delete("error");

    const search = params.toString();
    return search ? `${pathname}?${search}` : pathname;
  }

  const { query, setQuery, isPending } = useDebouncedQuerySync({
    initialQuery,
    buildHref,
  });

  return (
    <SearchField
      value={query}
      onChange={setQuery}
      pending={isPending}
      label="Search active check-ins by attendee name"
      placeholder="Search active check-ins by name"
    />
  );
}
