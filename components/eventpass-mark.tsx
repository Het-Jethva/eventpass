import { IconTicket } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

export function EventPassMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <IconTicket aria-hidden="true" className="size-5" />
      </span>
      {/* 560, the headline weight, not 600: semibold is reserved for the one
          place weight has to carry across a lit room. The scale already sets
          this size's tracking, so the wordmark does not re-decide it. */}
      <span className="text-base font-headline">EventPass</span>
    </div>
  );
}
