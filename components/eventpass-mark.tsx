import { IconTicket } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

export function EventPassMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <IconTicket aria-hidden="true" className="size-5" />
      </span>
      <span className="text-base font-semibold tracking-tight">EventPass</span>
    </div>
  );
}
