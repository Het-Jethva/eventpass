import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { IconArrowLeft, IconScan } from "@tabler/icons-react";

import { buttonVariants } from "@/components/ui/button";
import { ScannerWorkspace } from "@/features/admission/scanner-workspace";
import { getScannerEvent } from "@/features/admission/server/scanner";
import { getActiveStaffSession } from "@/lib/staff-session";

function formatWindow(opensAt: Date, closesAt: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  });
  return `${formatter.format(opensAt)} – ${formatter.format(closesAt)}`;
}

export default async function ScannerPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const session = await getActiveStaffSession();
  if (!session) redirect("/sign-in");
  const { eventId } = await params;
  const scannerEvent = await getScannerEvent(eventId, session.user.id);
  if (!scannerEvent) notFound();

  return (
    <main className="min-h-svh bg-background">
      <header className="border-b">
        <div className="mx-auto flex min-h-16 w-full max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href={`/events/${scannerEvent.id}`}
            className={buttonVariants({ variant: "ghost", size: "icon-lg" })}
            aria-label={`Back to ${scannerEvent.name}`}
          >
            <IconArrowLeft />
          </Link>
          <IconScan aria-hidden="true" className="size-6 shrink-0" />
          <div className="min-w-0">
            <p className="truncate font-medium">{scannerEvent.name}</p>
            <p className="text-sm text-muted-foreground">Online scanner</p>
          </div>
        </div>
      </header>
      <ScannerWorkspace
        eventId={scannerEvent.id}
        eventStatus={scannerEvent.status}
        checkInWindow={formatWindow(
          scannerEvent.checkInOpensAt,
          scannerEvent.checkInClosesAt,
          scannerEvent.eventTimeZone,
        )}
      />
    </main>
  );
}
