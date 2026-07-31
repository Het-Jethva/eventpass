"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IconSearch } from "@tabler/icons-react";

import { SegmentedFilter } from "@/components/segmented-filter";
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

      {/* Two independent filters. Shelled separately, because as one loose row
          they read as a single seven-option control with two options somehow
          active at the same time. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <SegmentedFilter
          label="Filter audit entries by category"
          size="sm"
          value={category}
          options={AUDIT_CATEGORIES.map((value) => ({
            value,
            label: AUDIT_CATEGORY_LABELS[value],
          }))}
          onSelect={(value) =>
            startTransition(() =>
              router.replace(
                buildHref({ category: value as AuditCategoryValue }),
              ),
            )
          }
        />

        <SegmentedFilter
          label="Filter audit entries by source"
          size="sm"
          value={source}
          options={AUDIT_SOURCES.map((value) => ({
            value,
            label: AUDIT_SOURCE_LABELS[value],
          }))}
          onSelect={(value) =>
            startTransition(() =>
              router.replace(buildHref({ source: value as AuditSourceValue })),
            )
          }
        />
      </div>
    </div>
  );
}
