import { Skeleton } from "@/components/ui/skeleton";

function EventsListSkeleton() {
  return (
    <main
      aria-label="Loading events"
      aria-busy="true"
      className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10"
    >
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-4 w-40 rounded-md" />
        </div>
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
      <div className="divide-y overflow-hidden rounded-2xl border bg-background">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
          >
            <div className="flex flex-1 flex-col gap-3">
              <Skeleton className="h-5 w-56 max-w-full rounded-md" />
              <Skeleton className="h-4 w-44 rounded-md" />
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-28 rounded-md" />
              <Skeleton className="h-8 w-16 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

export { EventsListSkeleton };
