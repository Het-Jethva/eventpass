"use client";

import { IconSearch } from "@tabler/icons-react";

import { Input } from "@/components/ui/input";

/**
 * The search-and-count band above each administration table.
 *
 * All three lists had grown their own copy of it around a raw `<input>` whose
 * focus ring was two pixels of solid `ring` — the only control in the product
 * that did not draw the system's three-pixel translucent one.
 */
export function AdminTableToolbar({
  label,
  placeholder,
  value,
  onValueChange,
  shown,
  total,
  noun,
}: {
  label: string;
  placeholder: string;
  value: string;
  onValueChange: (value: string) => void;
  shown: number;
  total: number;
  noun: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full max-w-sm">
        <IconSearch
          aria-hidden="true"
          className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={value}
          onChange={(changeEvent) => onValueChange(changeEvent.target.value)}
          placeholder={placeholder}
          aria-label={label}
          className="pl-9"
        />
      </div>
      <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
        {shown === total
          ? `${total.toLocaleString()} ${noun}`
          : `${shown.toLocaleString()} of ${total.toLocaleString()} ${noun}`}
      </p>
    </div>
  );
}
