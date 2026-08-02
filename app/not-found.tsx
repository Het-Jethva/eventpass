import Link from "next/link";
import { IconCompass } from "@tabler/icons-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export const metadata = { title: "Not found" };

/**
 * Reached by `notFound()` as well as unknown URLs, so the copy covers both an
 * Event the viewer cannot see and one that never existed — the distinction is
 * deliberately not disclosed, since Published Events are unlisted and
 * confirming an Event Slug exists would leak that.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-12 sm:px-6">
      {/* `grow-0` against Empty's own `flex-1`: the surrounding main already
          centres this, and letting the box grow stretched a two-line message
          into a dashed rectangle the full height of the viewport. */}
      <Empty className="min-h-72 grow-0 border bg-background">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconCompass aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>This page is not available</EmptyTitle>
          <EmptyDescription>
            The link may be mistyped, the event may have been withdrawn, or it
            may not be shared with this account.
          </EmptyDescription>
        </EmptyHeader>
        {/* Most of what reaches this page is a mistyped or expired public link
            — an Event page, a Ticket, an Admission Offer — and its holder has
            no staff account. Sending them to the workspace bounced them
            straight into sign-in, so the recovery ended in a second dead end.
            Home leads; the workspace stays reachable for staff who arrived here
            from an Event they cannot see. */}
        <EmptyContent>
          <Link href="/" className={buttonVariants()}>
            Go to EventPass
          </Link>
          <Link href="/events" className={buttonVariants({ variant: "outline" })}>
            Open the staff workspace
          </Link>
        </EmptyContent>
      </Empty>
    </main>
  );
}
