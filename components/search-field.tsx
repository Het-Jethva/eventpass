"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconSearch } from "@tabler/icons-react";

import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 250;

/**
 * Holds a search box's text in the URL, debounced.
 *
 * The query belongs in the URL so a view is shareable and survives a reload,
 * but writing on every keystroke would refetch the server on every letter.
 * Only the caller knows which sibling params a new query invalidates — a
 * cursor, a stale notice — so it supplies `buildHref` rather than passing a
 * list of keys to clear.
 *
 * `navigate` comes back out so adjacent controls (status filters, and such)
 * can push their own hrefs through the same transition, sharing one pending
 * state with the search box.
 */
export function useDebouncedQuerySync({
  initialQuery,
  buildHref,
}: {
  initialQuery: string;
  buildHref: (query: string) => string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(initialQuery);
  const isFirstRender = useRef(true);

  // `buildHref` closes over the current params, so the caller rebuilds it on
  // every render. Reading it through a ref keeps the debounce keyed to the
  // query alone, instead of restarting the timer on unrelated renders.
  const buildHrefRef = useRef(buildHref);
  useEffect(() => {
    buildHrefRef.current = buildHref;
  });

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (query === initialQuery) return;

    const timer = setTimeout(() => {
      startTransition(() => router.replace(buildHrefRef.current(query)));
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, initialQuery, router]);

  function navigate(href: string) {
    startTransition(() => router.replace(href));
  }

  return { query, setQuery, isPending, navigate };
}

/**
 * Search box with a leading icon and a trailing spinner while a query is in
 * flight. The input stays mounted across refetches so it keeps focus and
 * caret position mid-keystroke.
 */
export function SearchField({
  value,
  onChange,
  pending,
  label,
  placeholder,
  className,
  inputClassName,
}: {
  value: string;
  onChange: (value: string) => void;
  pending: boolean;
  label: string;
  placeholder: string;
  className?: string;
  inputClassName?: string;
}) {
  return (
    <div className={cn("relative max-w-sm", className)}>
      <IconSearch
        aria-hidden="true"
        className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        value={value}
        onChange={(changeEvent) => onChange(changeEvent.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className={cn("pl-9", inputClassName)}
      />
      {pending ? (
        <Spinner className="absolute top-1/2 right-3 size-4 -translate-y-1/2" />
      ) : null}
    </div>
  );
}
