"use client";

import { ErrorState } from "@/components/error-state";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-12 sm:px-6">
      <ErrorState
        title="Something went wrong"
        description="Nothing was changed. Retrying usually resolves it; if it does not, sign out and back in."
        digest={error.digest}
        onRetry={reset}
      />
    </main>
  );
}
