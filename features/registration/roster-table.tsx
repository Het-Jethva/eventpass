import Link from "next/link";
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconClock,
  IconClockExclamation,
  IconMailForward,
  IconUserCheck,
  IconUsers,
} from "@tabler/icons-react";
import type { Icon } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RosterStatusKey } from "@/features/registration/roster-status";
import {
  ROSTER_PAGE_SIZE,
  type EventRoster,
} from "@/features/registration/server/get-event-roster";

/**
 * Every status carries its own icon as well as its label, so an outcome is never
 * conveyed by colour alone.
 */
const STATUS_ICONS: Record<RosterStatusKey, Icon> = {
  checked_in: IconUserCheck,
  confirmed: IconCircleCheck,
  offer_sent: IconMailForward,
  waitlisted: IconUsers,
  unconfirmed: IconClock,
  expired: IconClockExclamation,
  canceled: IconAlertTriangle,
};

const BADGE_VARIANTS = {
  primary: "default",
  muted: "secondary",
  outline: "outline",
  destructive: "destructive",
} as const;

function formatMoment(value: Date, timeZone: string) {
  // Components spelled out rather than `dateStyle`/`timeStyle`, which cannot be
  // combined with `timeZoneName`.
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(value);
}

function formatDay(value: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone,
  }).format(value);
}

export function RosterTable({
  roster,
  eventTimeZone,
  /**
   * Built by the page, which owns the current search params — so paging keeps
   * the active search and filter instead of silently resetting them.
   */
  nextHref,
  hasActiveSearch,
}: {
  roster: EventRoster;
  eventTimeZone: string;
  nextHref: string | null;
  hasActiveSearch: boolean;
}) {
  if (roster.rows.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <RosterCount roster={roster} />
        <Empty className="min-h-64 border bg-background">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconUsers aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>
              {hasActiveSearch
                ? "No Registrations match"
                : "No Registrations yet"}
            </EmptyTitle>
            <EmptyDescription>
              {hasActiveSearch
                ? "Every Registration for this event was searched, not just the visible page. Try a shorter search or a different status."
                : "Registrations appear here once attendees register, or once you import them from a CSV below."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <RosterCount roster={roster} />

      <div className="overflow-hidden rounded-2xl border bg-background">
        <Table>
          <TableHeader className="bg-muted/50 text-xs text-muted-foreground">
            <TableRow>
              <TableHead scope="col">Attendee</TableHead>
              <TableHead scope="col">Status</TableHead>
              <TableHead scope="col">Ticket</TableHead>
              <TableHead scope="col">Registered</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roster.rows.map((row) => {
              const StatusIcon = STATUS_ICONS[row.status.key];
              const hasDetail = row.answers.length > 0;

              return (
                <TableRow key={row.registrationId} className="align-top">
                  <TableCell className="whitespace-normal">
                    <div className="font-medium text-foreground">
                      {row.attendeeName}
                    </div>
                    <div className="font-mono text-xs break-all text-muted-foreground">
                      {row.email}
                    </div>
                    {row.source === "imported" ? (
                      <Badge variant="outline" className="mt-1.5 text-xs">
                        Imported Registration
                      </Badge>
                    ) : null}
                    {hasDetail ? (
                      <details className="mt-2 text-xs">
                        <summary className="w-fit cursor-pointer rounded text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                          {row.answers.length} answer
                          {row.answers.length === 1 ? "" : "s"}
                        </summary>
                        <dl className="mt-2 flex flex-col gap-2 border-l pl-3">
                          {row.answers.map((answer) => (
                            <div key={answer.fieldId}>
                              <dt className="font-medium text-foreground">
                                {answer.label}
                                {answer.archived ? (
                                  <span className="ml-1.5 font-normal text-muted-foreground">
                                    (archived)
                                  </span>
                                ) : null}
                              </dt>
                              <dd className="whitespace-pre-wrap text-muted-foreground">
                                {answer.value}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                    ) : null}
                  </TableCell>

                  <TableCell className="whitespace-normal">
                    <Badge
                      variant={BADGE_VARIANTS[row.status.emphasis]}
                      className="gap-1.5"
                    >
                      <StatusIcon aria-hidden="true" className="size-3.5" />
                      {row.status.label}
                    </Badge>
                    {row.status.qualifier ? (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {row.status.qualifier}
                      </p>
                    ) : null}
                    {row.status.deadline ? (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {row.status.deadline.kind === "capacity_hold"
                          ? "Capacity Hold expires"
                          : "Offer expires"}{" "}
                        {formatMoment(row.status.deadline.at, eventTimeZone)}
                      </p>
                    ) : null}
                    {row.checkedInAt ? (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {formatMoment(row.checkedInAt, eventTimeZone)}
                      </p>
                    ) : null}
                  </TableCell>

                  <TableCell className="font-mono text-xs">
                    {row.ticketCode ?? (
                      <span className="font-sans text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell className="text-xs text-muted-foreground">
                    {formatDay(row.registeredAt, eventTimeZone)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {nextHref ? (
        <div className="flex justify-center">
          <Link
            href={nextHref}
            className={buttonVariants({ variant: "outline" })}
            prefetch={false}
          >
            Next {ROSTER_PAGE_SIZE} Registrations
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function RosterCount({ roster }: { roster: EventRoster }) {
  const isFiltered = roster.matchingCount !== roster.totalCount;

  return (
    <p
      className="text-sm text-muted-foreground"
      // Announced so a keyboard or screen-reader user learns the result count
      // changed without having to hunt for it after each search.
      role="status"
      aria-live="polite"
    >
      {isFiltered
        ? `${roster.matchingCount.toLocaleString()} of ${roster.totalCount.toLocaleString()} Registrations match`
        : `${roster.totalCount.toLocaleString()} Registration${roster.totalCount === 1 ? "" : "s"}`}
    </p>
  );
}
