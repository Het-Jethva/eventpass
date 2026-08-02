import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { IconArrowLeft, IconScan } from "@tabler/icons-react";

import { buttonVariants } from "@/components/ui/button";
import { ScannerWorkspace } from "@/features/admission/scanner-workspace";
import { getScannerEvent } from "@/features/admission/server/scanner";
import { getActiveStaffSession } from "@/lib/staff-session";

// `formatRange` collapses the parts both ends share, so a door that opens and
// closes on one day reads "Jul 31, 2026, 5:03 – 14:03" rather than printing the
// same date twice. Every other schedule in the product is formatted this way.
function formatWindow(opensAt: Date, closesAt: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).formatRange(opensAt, closesAt);
}

export default async function ScannerPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const session = await getActiveStaffSession();
  // Carries the door back to sign-in. A volunteer handed a scanner link opens it
  // on a phone that has never signed in, and the bare redirect landed them on
  // the events list with the queue already forming — the one page in the product
  // where "sign in, then find your way back" is the wrong instruction.
  if (!session) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/scanner/${eventId}`)}`);
  }
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
            <p className="text-sm text-muted-foreground">Scanner workspace</p>
          </div>
        </div>
      </header>
      <ScannerWorkspace
        eventId={scannerEvent.id}
        eventStatus={scannerEvent.status}
        eventSuspended={scannerEvent.suspended}
        actorRole={scannerEvent.role}
        checkInWindow={formatWindow(
          scannerEvent.checkInOpensAt,
          scannerEvent.checkInClosesAt,
          scannerEvent.eventTimeZone,
        )}
      />
    </main>
  );
}
