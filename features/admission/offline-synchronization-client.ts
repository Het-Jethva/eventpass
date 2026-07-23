"use client";

import { offlineScannerStore } from "./offline-snapshot-store";

type SynchronizationResponse =
  | {
      outcome: "acknowledged";
      results: Array<{
        id: string;
        ticketId: string | null;
        outcome: string;
        changed: boolean;
      }>;
    }
  | { outcome: "unauthorized" | "invalid_request"; results: [] };

export async function synchronizePendingAttempts(eventId: string) {
  const pending = await offlineScannerStore.listPendingScanAttempts(eventId);
  if (pending.length === 0) {
    return {
      acknowledged: 0,
      changed: 0,
      reconciledOutcomes: [] as string[],
    };
  }

  let acknowledged = 0;
  let changed = 0;
  const reconciledOutcomes: string[] = [];
  const authorizations = new Map<string, typeof pending>();
  for (const attempt of pending) {
    const batch = authorizations.get(attempt.authorization) ?? [];
    batch.push(attempt);
    authorizations.set(attempt.authorization, batch);
  }

  for (const [authorization, attempts] of authorizations) {
    for (let offset = 0; offset < attempts.length; offset += 50) {
      const batch = attempts.slice(offset, offset + 50);
      const response = await fetch("/api/scanner/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ authorization, attempts: batch }),
      });
      const result = (await response.json()) as SynchronizationResponse;
      if (!response.ok || result.outcome !== "acknowledged") {
        throw new Error("Synchronization was not acknowledged.");
      }
      await offlineScannerStore.acknowledgeScanAttempts(
        eventId,
        result.results,
      );
      acknowledged += result.results.length;
      changed += result.results.filter((item) => item.changed).length;
      reconciledOutcomes.push(
        ...result.results
          .filter((item) => item.changed)
          .map((item) => item.outcome),
      );
    }
  }
  return { acknowledged, changed, reconciledOutcomes };
}
