"use client";

import { useState } from "react";
import {
  IconHistory,
  IconSearch,
  IconShield,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  AuditCategory,
  AuditSourceFilter,
  FormattedAuditRecord,
} from "@/features/audit/server/get-audit-log";
import { cn } from "@/lib/utils";

type AuditViewProps = {
  eventId?: string;
  initialRecords: FormattedAuditRecord[];
};

export function AuditView({ initialRecords }: AuditViewProps) {
  const [categoryFilter, setCategoryFilter] = useState<AuditCategory>("all");
  const [sourceFilter, setSourceFilter] = useState<AuditSourceFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRecords = initialRecords.filter((record) => {
    // Category filter
    if (categoryFilter === "privileged" && record.category !== "privileged") {
      return false;
    }
    if (categoryFilter === "scans" && record.category !== "scan") {
      return false;
    }
    if (categoryFilter === "conflicts_reversals") {
      const isConflictOrReversal =
        record.action.includes("conflict") || record.action.includes("reversal");
      if (!isConflictOrReversal) return false;
    }

    // Source filter
    if (sourceFilter !== "all" && record.source !== sourceFilter) {
      return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchActor =
        record.actorName.toLowerCase().includes(q) ||
        (record.actorEmail && record.actorEmail.toLowerCase().includes(q));
      const matchAction =
        record.action.toLowerCase().includes(q) ||
        record.actionLabel.toLowerCase().includes(q);
      const matchTarget =
        record.targetType.toLowerCase().includes(q) ||
        (record.targetLabel && record.targetLabel.toLowerCase().includes(q)) ||
        record.targetId.toLowerCase().includes(q);
      const matchReason = record.reason && record.reason.toLowerCase().includes(q);

      if (!matchActor && !matchAction && !matchTarget && !matchReason) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header Info & Protection Note */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <IconHistory className="size-5 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-lg font-semibold tracking-tight">
              Immutable Audit Log
            </h2>
            <Badge variant="secondary" className="font-mono text-xs">
              {filteredRecords.length} record{filteredRecords.length !== 1 ? "s" : ""}
            </Badge>
          </div>
          <Badge variant="outline" className="gap-1.5 font-mono text-xs font-normal">
            <IconShield className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            Append-only (DB Protected)
          </Badge>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Every security-relevant change, Organizer configuration action, check-in reversal, conflict resolution, and scan attempt is appended immutably with actor, time, target, device, and reason.
        </p>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <IconSearch className="absolute left-3 top-2.5 size-4 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            placeholder="Search actor, ticket, action, reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs"
            aria-label="Search audit entries"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Tabs */}
          <div className="inline-flex rounded-lg border bg-muted/40 p-1 text-xs">
            <button
              onClick={() => setCategoryFilter("all")}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors",
                categoryFilter === "all"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              All Events
            </button>
            <button
              onClick={() => setCategoryFilter("privileged")}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors",
                categoryFilter === "privileged"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Privileged Changes
            </button>
            <button
              onClick={() => setCategoryFilter("scans")}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors",
                categoryFilter === "scans"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Scan Attempts
            </button>
            <button
              onClick={() => setCategoryFilter("conflicts_reversals")}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors",
                categoryFilter === "conflicts_reversals"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Conflicts & Reversals
            </button>
          </div>

          {/* Source Dropdown / Toggle */}
          <div className="inline-flex rounded-lg border bg-muted/40 p-1 text-xs">
            <button
              onClick={() => setSourceFilter("all")}
              className={cn(
                "rounded-md px-2 py-1 font-medium transition-colors",
                sourceFilter === "all"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              All Sources
            </button>
            <button
              onClick={() => setSourceFilter("online")}
              className={cn(
                "rounded-md px-2 py-1 font-medium transition-colors",
                sourceFilter === "online"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Online
            </button>
            <button
              onClick={() => setSourceFilter("offline")}
              className={cn(
                "rounded-md px-2 py-1 font-medium transition-colors",
                sourceFilter === "offline"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Offline
            </button>
          </div>
        </div>
      </div>

      {/* Audit Log Table / Cards */}
      {filteredRecords.length > 0 ? (
        <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
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
              {filteredRecords.map((record) => {
                const date = new Date(record.createdAt);
                const isScan = record.category === "scan";
                const isConflictOrReversal =
                  record.action.includes("conflict") || record.action.includes("reversal");

                return (
                  <TableRow key={record.id}>
                    <TableCell className="font-mono text-muted-foreground">
                      {date.toLocaleDateString([], { month: "short", day: "numeric" })}{" "}
                      {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </TableCell>

                    <TableCell className="font-medium">
                      <div>{record.actorName}</div>
                      {record.actorEmail ? (
                        <div className="font-mono text-[11px] text-muted-foreground">
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
                        className="text-[11px] font-normal"
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
                            variant={record.source === "offline" ? "outline" : "secondary"}
                            className="font-mono text-[10px] capitalize"
                          >
                            {record.source}
                          </Badge>
                          {record.timestampConfidence === "low" ? (
                            <Badge variant="destructive" className="text-[10px]">
                              Low confidence clock
                            </Badge>
                          ) : null}
                        </div>
                        {record.scannerDeviceId ? (
                          <span className="max-w-32 truncate font-mono text-[10px] text-muted-foreground">
                            Device: {record.scannerDeviceId.slice(0, 8)}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>

                    <TableCell className="max-w-xs whitespace-normal leading-relaxed text-muted-foreground">
                      {record.reason ? (
                        <span className="text-foreground">{record.reason}</span>
                      ) : record.metadata && Object.keys(record.metadata).length > 0 ? (
                        <span className="font-mono text-[10px]">
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
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card p-12 text-center">
          <IconHistory className="size-10 text-muted-foreground/60" aria-hidden="true" />
          <h3 className="mt-4 font-semibold tracking-tight">No audit entries found</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            {searchQuery || categoryFilter !== "all" || sourceFilter !== "all"
              ? "No audit records match your current search criteria or active filters."
              : "No privileged actions or scan attempts have been logged yet for this Event."}
          </p>
        </div>
      )}
    </div>
  );
}
