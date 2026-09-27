import { Skeleton } from "@/components/ui/skeleton";

function MetricPanelSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-5">
      <Skeleton className="h-4 w-28 rounded-md" />
      <Skeleton className="h-11 w-36 rounded-md" />
      <Skeleton className="h-1.5 w-full rounded-full" />
      <Skeleton className="h-4 w-44 rounded-md" />
    </div>
  );
}

function LiveMetricsSkeleton() {
  return (
    <div
      aria-label="Loading live event metrics"
      aria-busy="true"
      className="flex flex-col gap-6"
    >
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-2.5 rounded-full" />
        <Skeleton className="h-6 w-40 rounded-md" />
        <Skeleton className="h-5 w-20 rounded-md" />
      </div>
      <div className="grid divide-y overflow-hidden rounded-lg border bg-card sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3 lg:divide-x">
        <MetricPanelSkeleton />
        <div className="border-t sm:border-t-0 sm:border-l lg:border-l-0">
          <MetricPanelSkeleton />
        </div>
        <div className="border-t sm:col-span-2 lg:col-span-1 lg:border-t-0 lg:border-l">
          <MetricPanelSkeleton />
        </div>
      </div>
    </div>
  );
}

export { LiveMetricsSkeleton };
