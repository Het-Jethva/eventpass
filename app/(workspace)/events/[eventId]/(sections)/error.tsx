"use client";

import { ErrorState } from "@/components/error-state";

// Scoped to the section, so the Event workspace shell above it — identity, nav,
// the way back — survives and the Organizer is never stranded on a blank page.
export default function EventSectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="This section could not be loaded"
      description="Nothing was changed. The rest of the Event workspace is still available from the navigation above."
      digest={error.digest}
      onRetry={reset}
    />
  );
}
