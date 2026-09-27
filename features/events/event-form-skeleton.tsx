import { Skeleton } from "@/components/ui/skeleton";

function EventFormSkeleton() {
  return (
    <main
      aria-label="Loading event form"
      aria-busy="true"
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-44 rounded-md" />
        <Skeleton className="h-4 w-80 max-w-full rounded-md" />
      </div>
      <div className="flex flex-col gap-8 rounded-2xl border bg-background p-5 sm:p-6">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        ))}
        <div className="flex justify-end gap-3 border-t pt-6">
          <Skeleton className="h-10 w-20 rounded-md" />
          <Skeleton className="h-10 w-32 rounded-md" />
        </div>
      </div>
    </main>
  );
}

export { EventFormSkeleton };
