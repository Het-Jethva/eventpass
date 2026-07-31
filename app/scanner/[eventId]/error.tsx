"use client";

import Link from "next/link";
import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";

import { Button, buttonVariants } from "@/components/ui/button";

/**
 * The scanner's own error surface rather than the shared one.
 *
 * A Volunteer hitting this is standing in a queue, so it has to be readable at
 * arm's length and unambiguous about the one thing that matters: no admission
 * was recorded. Touch targets stay at the 44px minimum the scanner uses
 * everywhere else, and the route back to the event workspace is explicit.
 */
export default function ScannerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <IconAlertTriangle aria-hidden="true" className="size-12 text-destructive-text" />
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-headline">
          The scanner could not start
        </h1>
        <p className="mx-auto max-w-md text-reading text-muted-foreground">
          No admission was recorded. Nothing about this attendee&apos;s ticket
          changed, so it can still be scanned once the scanner reloads.
        </p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <Button onClick={reset} size="lg" className="min-h-11 w-full">
          <IconRefresh data-icon="inline-start" />
          Reload the scanner
        </Button>
        <Link
          href="/events"
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          Back to events
        </Link>
      </div>
      {error.digest ? (
        <p className="font-mono text-xs text-muted-foreground">
          Reference {error.digest}
        </p>
      ) : null}
    </main>
  );
}
