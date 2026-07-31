"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * The product's one segmented control: a hairlined shell holding mutually
 * exclusive options, with the active one taking the secondary fill.
 *
 * It exists because the roster and the audit log had each grown their own
 * loose row of buttons filled `bg-foreground`. That was a third treatment
 * beside the theme switcher's, and on the audit log — which shows two groups
 * side by side — an unshelled row read as seven buttons with two of them
 * inexplicably highlighted. The shell is what says "pick one of these".
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
    <div
      role="group"
      aria-label={label}
      className={cn(
        "flex w-fit max-w-full items-center gap-0.5 overflow-x-auto rounded-lg border p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
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
  );
}
