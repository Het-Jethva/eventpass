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
      <Empty className="min-h-72 border bg-background">
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
        <EmptyContent>
          <Link href="/events" className={buttonVariants()}>
            Go to events
          </Link>
        </EmptyContent>
      </Empty>
    </main>
  );
}
