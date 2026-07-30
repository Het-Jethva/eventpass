"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IconSearch } from "@tabler/icons-react";

import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

const DEBOUNCE_MS = 250;

/**
 * Name search for the active Check-ins list, held in the URL so the query
 * survives the page reload a reversal triggers.
 */
export function ActiveCheckInSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(initialQuery);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (query === initialQuery) return;

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (query.trim()) params.set("q", query.trim());
      else params.delete("q");
      // Stale notices belong to the previous action, not this search.
      params.delete("notice");
      params.delete("error");

      const search = params.toString();
      startTransition(() =>
        router.replace(search ? `${pathname}?${search}` : pathname),
      );
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, initialQuery, router, pathname]);

  return (
    <div className="relative max-w-sm">
      <IconSearch
        aria-hidden="true"
        className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        value={query}
        onChange={(changeEvent) => setQuery(changeEvent.target.value)}
        placeholder="Search active Check-ins by name"
        aria-label="Search active Check-ins by attendee name"
        className="pl-9"
      />
      {isPending ? (
        <Spinner className="absolute top-1/2 right-3 size-4 -translate-y-1/2" />
      ) : null}
    </div>
  );
}
