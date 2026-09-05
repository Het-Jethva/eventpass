import { IconHistory } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { PendingLink } from "@/components/pending-link";
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
import { AuditFilterControls } from "@/features/audit/audit-filter-controls";
import type {
  AuditCategoryValue,
  AuditSourceValue,
} from "@/features/audit/audit-filters";
import {
  AUDIT_PAGE_SIZE,
  type EventAuditLog,
} from "@/features/audit/server/get-audit-log";
import { formatTicketCode } from "@/features/tickets/ticket-code";

// The whole product writes a Ticket Code grouped, because that is how a person
// reads one aloud. The audit log printed it as ten unbroken characters.
const TICKET_CODE = /^[0-9A-HJKMNP-TV-Z]{10}$/;

function formatAuditTarget(value: string) {
  return TICKET_CODE.test(value) ? formatTicketCode(value) : value;
}

// One clock format across the product: 24-hour, seconds, no lowercase meridiem.
// This column is read by comparison against the scanner and the roster, and
// `31 Jul 03:27:48 pm` matched neither of them.
function formatAuditTimestamp(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone,
    timeZoneName: "short",
  }).format(date);
}

export function AuditView({
  log,
  eventTimeZone,
  category,
  source,
  initialQuery,
  nextHref,
}: {
  log: EventAuditLog;
  eventTimeZone: string;
  category: AuditCategoryValue;
  source: AuditSourceValue;
  initialQuery: string;
  nextHref: string | null;
}) {
  const isFiltered = log.matchingCount !== log.totalCount;

  return (
    <div className="flex flex-col gap-6">
      {/* The page header already says what this log is. A second card repeating
          it in longer words was the only thing between the title and the
          controls someone came here to use. */}
      <AuditFilterControls
        category={category}
        source={source}
        initialQuery={initialQuery}
      />

      {/*
        The count states what was searched, not just what is shown. The previous
        implementation searched the most recent 200 Audit Entries and 300 Scan
        Attempts in the browser while appearing to search the whole log.
      */}
      <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
        {isFiltered
          ? `${log.matchingCount.toLocaleString()} of ${log.totalCount.toLocaleString()} entries match`
          : `${log.totalCount.toLocaleString()} ${log.totalCount === 1 ? "entry" : "entries"}`}
      </p>

      {log.records.length > 0 ? (
        <>
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table className="text-xs">
              <TableHeader className="bg-muted/50 text-muted-foreground">
                <TableRow>
                  <TableHead scope="col">Timestamp</TableHead>
                  <TableHead scope="col">Actor</TableHead>
                  <TableHead scope="col">Action</TableHead>
                  <TableHead scope="col">Target</TableHead>
                  <TableHead scope="col">Source</TableHead>
                  <TableHead scope="col">Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {log.records.map((record) => {
                  const date = new Date(record.createdAt);
                  const isScan = record.category === "scan";
                  const isConflictOrReversal =
                    record.action.includes("conflict") ||
                    record.action.includes("reversal");

                  return (
                    <TableRow key={record.id}>
                      <TableCell className="font-mono text-muted-foreground">
                        <time dateTime={record.createdAt}>
                          {formatAuditTimestamp(date, eventTimeZone)}
                        </time>
                      </TableCell>

                      <TableCell className="font-medium">
                        <div>{record.actorName}</div>
                        {record.actorEmail ? (
                          <div className="font-mono text-xs text-muted-foreground">
                            {record.actorEmail}
                          </div>
                        ) : null}
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant={
                            isConflictOrReversal
                              ? "destructive"
                              : isScan
                                ? "secondary"
                                : "default"
                          }
                          className="text-xs font-normal"
                        >
                          {record.actionLabel}
                        </Badge>
                      </TableCell>

                      <TableCell className="font-mono">
                        {formatAuditTarget(record.targetLabel ?? record.targetId)}
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1">
                            <Badge
                              variant={
                                record.source === "offline" ? "outline" : "secondary"
                              }
                              className="font-mono text-xs capitalize"
                            >
                              {record.source}
                            </Badge>
                            {record.timestampConfidence === "low" ? (
                              // "Low confidence clock" named the mechanism. The
                              // organizer needs the consequence: this row's time
                              // is the phone's, and the phone's may be wrong.
                              <Badge variant="warning" className="text-xs">
                                Time may be off
                              </Badge>
                            ) : null}
                          </div>
                          {record.scannerDeviceId ? (
                            <span className="max-w-32 truncate text-xs text-muted-foreground">
                              Phone{" "}
                              <span className="font-mono">
                                {record.scannerDeviceId.slice(0, 6)}
                              </span>
                            </span>
                          ) : null}
                        </div>
                      </TableCell>

                      <TableCell className="max-w-xs whitespace-normal text-muted-foreground">
                        {record.reason ? (
                          <span className="text-foreground">{record.reason}</span>
                        ) : record.metadata &&
                          Object.keys(record.metadata).length > 0 ? (
                          // Was a raw JSON.stringify in the cell. The same
                          // facts, read as a sentence instead of as a payload.
                          <span>
                            {Object.entries(record.metadata)
                              .map(
                                ([key, value]) =>
                                  `${key.replace(/[_-]/g, " ")}: ${String(value)}`,
                              )
                              .join(" · ")}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {nextHref ? (
            <div className="flex justify-center">
              <PendingLink
                href={nextHref}
                className={buttonVariants({ variant: "outline" })}
                prefetch={false}
                pendingLabel="Loading more"
              >
                Next {AUDIT_PAGE_SIZE} entries
              </PendingLink>
            </div>
          ) : null}
        </>
      ) : (
        <Empty className="border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconHistory aria-hidden="true" />
            </EmptyMedia>
            {/* The title branches with the description. An event whose log is
                simply empty was told "Nothing matches" — naming a search it had
                not run. The roster's empty state already makes this
                distinction; this one only made it in the sentence below. */}
            <EmptyTitle>
              {isFiltered || initialQuery
                ? "Nothing matches"
                : "Nothing recorded yet"}
            </EmptyTitle>
            <EmptyDescription>
              {isFiltered || initialQuery
                ? "The whole log was searched, not just the visible page. Try a shorter search or a different filter."
                : "Activity on this event — registrations, scans, and organizer changes — appears here as it happens."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}
