import { IconCalendarEvent } from "@tabler/icons-react";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function EventsPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
        <p className="text-sm text-muted-foreground">
          Events you own or staff will appear here.
        </p>
      </div>

      <Empty className="min-h-80 border bg-background">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconCalendarEvent aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>No Events yet</EmptyTitle>
          <EmptyDescription>
            Your staff access is ready. Events assigned to this email address
            will be available in this workspace.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </main>
  );
}
