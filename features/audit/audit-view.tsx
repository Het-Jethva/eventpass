import Link from "next/link";
import { IconHistory, IconShield } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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

export function AuditView({
  log,
  category,
  source,
  initialQuery,
  nextHref,
}: {
  log: EventAuditLog;
  category: AuditCategoryValue;
  source: AuditSourceValue;
  initialQuery: string;
  nextHref: string | null;
}) {
  const isFiltered = log.matchingCount !== log.totalCount;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <IconHistory className="size-5 text-muted-foreground" aria-hidden="true" />
            <h3 className="text-lg font-semibold tracking-tight">
              Immutable audit log
            </h3>
          </div>
          <Badge variant="outline" className="gap-1.5 font-mono text-xs font-normal">
            <IconShield className="size-3.5" aria-hidden="true" />
            Append-only, enforced by the database
          </Badge>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Every security-relevant change, Organizer configuration action,
          check-in reversal, conflict resolution, and Scan Attempt is appended
          immutably with actor, time, target, device, and reason.
        </p>
      </div>

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
                        {date.toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        {date.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
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
                        {record.targetLabel ?? record.targetId}
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
                              <Badge variant="destructive" className="text-xs">
                                Low confidence clock
                              </Badge>
                            ) : null}
                          </div>
                          {record.scannerDeviceId ? (
                            <span className="max-w-32 truncate font-mono text-xs text-muted-foreground">
                              Device: {record.scannerDeviceId.slice(0, 8)}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>

                      <TableCell className="max-w-xs whitespace-normal leading-relaxed text-muted-foreground">
                        {record.reason ? (
                          <span className="text-foreground">{record.reason}</span>
                        ) : record.metadata &&
                          Object.keys(record.metadata).length > 0 ? (
                          <span className="font-mono text-xs">
                            {JSON.stringify(record.metadata)}
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
              <Link
                href={nextHref}
                className={buttonVariants({ variant: "outline" })}
                prefetch={false}
              >
                Next {AUDIT_PAGE_SIZE} entries
              </Link>
            </div>
          ) : null}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card p-12 text-center">
          <IconHistory className="size-10 text-muted-foreground/60" aria-hidden="true" />
          <h4 className="mt-4 font-semibold tracking-tight">
            No audit entries found
          </h4>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            {isFiltered || initialQuery
              ? "The whole log was searched, not just the visible page. Try a shorter search or a different filter."
              : "No privileged actions or Scan Attempts have been recorded yet for this Event."}
          </p>
        </div>
      )}
    </div>
  );
}
