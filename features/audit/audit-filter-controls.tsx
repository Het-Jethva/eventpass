"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IconSearch } from "@tabler/icons-react";

import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  AUDIT_CATEGORIES,
  AUDIT_CATEGORY_LABELS,
  AUDIT_SOURCE_LABELS,
  AUDIT_SOURCES,
  type AuditCategoryValue,
  type AuditSourceValue,
} from "@/features/audit/audit-filters";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 250;

export function AuditFilterControls({
  category,
  source,
  initialQuery,
}: {
  category: AuditCategoryValue;
  source: AuditSourceValue;
  initialQuery: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(initialQuery);
  const isFirstRender = useRef(true);

  function buildHref(next: {
    query?: string;
    category?: AuditCategoryValue;
    source?: AuditSourceValue;
  }) {
    const params = new URLSearchParams(searchParams.toString());

    const nextQuery = next.query ?? query;
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    else params.delete("q");

    const nextCategory = next.category ?? category;
    if (nextCategory !== "all") params.set("category", nextCategory);
    else params.delete("category");

    const nextSource = next.source ?? source;
    if (nextSource !== "all") params.set("source", nextSource);
    else params.delete("source");

    // A changed result set invalidates the cursor.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, initialQuery, router]);

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div className="relative max-w-sm">
        <IconSearch
          aria-hidden="true"
          className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={query}
          onChange={(changeEvent) => setQuery(changeEvent.target.value)}
          placeholder="Search actor, action, target, reason"
          aria-label="Search audit entries"
          className="pl-9 text-xs"
        />
        {isPending ? (
          <Spinner className="absolute top-1/2 right-3 size-4 -translate-y-1/2" />
        ) : null}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
        <div
          className="flex flex-wrap gap-1"
          role="group"
          aria-label="Filter audit entries by category"
        >
          {AUDIT_CATEGORIES.map((value) => (
            <FilterChip
              key={value}
              label={AUDIT_CATEGORY_LABELS[value]}
              isActive={value === category}
              onSelect={() =>
                startTransition(() =>
                  router.replace(buildHref({ category: value })),
                )
              }
            />
          ))}
        </div>

        <div
          className="flex flex-wrap gap-1"
          role="group"
          aria-label="Filter audit entries by source"
        >
          {AUDIT_SOURCES.map((value) => (
            <FilterChip
              key={value}
              label={AUDIT_SOURCE_LABELS[value]}
              isActive={value === source}
              onSelect={() =>
                startTransition(() => router.replace(buildHref({ source: value })))
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  label,
  isActive,
  onSelect,
}: {
  label: string;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onSelect}
      className={cn(
        "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
        isActive
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
