import { Skeleton } from "@/components/ui/skeleton";
import { LiveMetricsSkeleton } from "@/features/events/live-metrics-skeleton";

function EventWorkspaceSkeleton() {
  return (
    <div
      aria-label="Opening event workspace"
      aria-busy="true"
      className="mx-auto flex w-full max-w-7xl flex-1 flex-col lg:flex-row"
    >
      <aside className="hidden w-64 shrink-0 border-r bg-sidebar p-4 lg:block">
        <Skeleton className="h-5 w-20 rounded-md" />
        <Skeleton className="mt-6 h-6 w-40 rounded-md" />
        <Skeleton className="mt-3 h-5 w-20 rounded-md" />
        <div className="mt-8 flex flex-col gap-2">
          {Array.from({ length: 7 }, (_, index) => (
            <Skeleton key={index} className="h-9 w-full rounded-md" />
          ))}
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <Skeleton className="h-8 w-32 rounded-md" />
        <LiveMetricsSkeleton />
        <section className="rounded-2xl border bg-background p-5 sm:p-6">
          <Skeleton className="h-5 w-44 rounded-md" />
          <Skeleton className="mt-3 h-4 w-72 max-w-full rounded-md" />
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="flex gap-3">
                <Skeleton className="size-5 shrink-0 rounded-md" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-24 rounded-md" />
                  <Skeleton className="h-4 w-48 max-w-full rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export { EventWorkspaceSkeleton };
