"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { SearchField, useDebouncedQuerySync } from "@/components/search-field";
import { SegmentedFilter } from "@/components/segmented-filter";
import {
  AUDIT_CATEGORIES,
  AUDIT_CATEGORY_LABELS,
  AUDIT_SOURCE_LABELS,
  AUDIT_SOURCES,
  type AuditCategoryValue,
  type AuditSourceValue,
} from "@/features/audit/audit-filters";

export function AuditFilterControls({
  category,
  source,
  initialQuery,
}: {
  category: AuditCategoryValue;
  source: AuditSourceValue;
  initialQuery: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function buildHref(next: {
    query: string;
    category?: AuditCategoryValue;
    source?: AuditSourceValue;
  }) {
    const params = new URLSearchParams(searchParams.toString());

    if (next.query.trim()) params.set("q", next.query.trim());
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

  const { query, setQuery, isPending, navigate } = useDebouncedQuerySync({
    initialQuery,
    buildHref: (nextQuery) => buildHref({ query: nextQuery }),
  });

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <SearchField
        value={query}
        onChange={setQuery}
        pending={isPending}
        label="Search audit entries"
        placeholder="Search actor, action, target, reason"
        inputClassName="text-xs"
      />

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
            navigate(
              buildHref({ query, category: value as AuditCategoryValue }),
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
            navigate(buildHref({ query, source: value as AuditSourceValue }))
          }
        />
      </div>
    </div>
  );
}
