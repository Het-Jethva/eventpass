"use client";

import Link, { useLinkStatus } from "next/link";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type PendingLinkProps = React.ComponentProps<typeof Link> & {
  pendingLabel?: string;
};

function PendingLinkState({ label }: { label: string }) {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden={!pending}
      aria-label={label || "Loading"}
      aria-live="polite"
      role="status"
      data-pending={pending ? "true" : "false"}
      onClick={
        pending
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
            }
          : undefined
      }
      className={cn(
        "pointer-events-none absolute inset-0 z-10 inline-flex items-center justify-center gap-1.5 rounded-[inherit]",
        pending ? "visible pointer-events-auto cursor-wait" : "invisible",
      )}
    >
      <Spinner aria-hidden="true" />
      {label ? <span>{label}</span> : null}
    </span>
  );
}

/**
 * A Next.js Link with immediate, layout-stable feedback for dynamic routes.
 * Route-level loading boundaries still own the destination skeleton; this
 * state covers the gap before an uncached fallback has reached the browser.
 */
function PendingLink({
  children,
  className,
  pendingLabel = "Loading",
  ...props
}: PendingLinkProps) {
  return (
    <Link data-slot="pending-link" className={cn("relative", className)} {...props}>
      <span data-slot="pending-link-content" className="contents">
        {children}
      </span>
      <PendingLinkState label={pendingLabel} />
    </Link>
  );
}

export { PendingLink };
