"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * The product's one segmented control. A hairlined shell holds mutually
 * exclusive options. The active option takes the secondary fill.
 */
export function SegmentedFilter({
  className,
  label,
  options,
  value,
  onSelect,
  size = "default",
}: {
  className?: string;
  label: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onSelect: (value: string) => void;
  size?: "default" | "sm";
}) {
  return (
    <>
      <div className={cn("sm:hidden", className)}>
        <Select items={options} value={value} onValueChange={(next) => { if (next !== null) onSelect(next); }}>
          <SelectTrigger aria-label={label} className="h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start" alignItemWithTrigger={false}>
            <SelectGroup>
              {options.map((option) => <SelectItem className="min-h-11" key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <div
      role="group"
      aria-label={label}
      className={cn(
        "hidden w-fit max-w-full flex-wrap items-center gap-0.5 rounded-lg border p-0.5 sm:flex",
        className,
      )}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <Button
            key={option.value}
            type="button"
            size={size === "sm" ? "xs" : "sm"}
            variant={isActive ? "secondary" : "ghost"}
            aria-pressed={isActive}
            onClick={() => onSelect(option.value)}
            className={cn("shrink-0", !isActive && "text-muted-foreground")}
          >
            {option.label}
          </Button>
        );
      })}
      </div>
    </>
  );
}
