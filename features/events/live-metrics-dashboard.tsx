"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconCheck,
  IconClock,
  IconDeviceMobile,
  IconMail,
  IconRefresh,
  IconScan,
  IconTicket,
  IconUsers,
  IconUserCheck,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { LiveEventMetricsResult } from "@/features/events/event-metrics-policy";

type LiveMetricsDashboardProps = {
  eventId: string;
  initialMetrics: LiveEventMetricsResult;
};

export function LiveMetricsDashboard({
  eventId,
  initialMetrics,
}: LiveMetricsDashboardProps) {
  const [metrics, setMetrics] = useState<LiveEventMetricsResult>(initialMetrics);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(
    new Date(initialMetrics.refreshedAt),
  );

  useEffect(() => {
    let isMounted = true;

    async function fetchMetrics() {
      try {
        setIsRefreshing(true);
        const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/live-metrics`);
        if (res.ok) {
          const data: LiveEventMetricsResult = await res.json();
          if (isMounted) {
            setMetrics(data);
            setLastRefreshedAt(new Date(data.refreshedAt));
          }
        }
      } catch (err) {
        console.error("Failed to refresh live metrics:", err);
      } finally {
        if (isMounted) setIsRefreshing(false);
      }
    }

    const interval = setInterval(fetchMetrics, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [eventId]);

  const { overview, scanAttemptStats, checkInConflictStats, pendingDeviceSync, deliveryOutcomes, checkInsOverTime } = metrics;

  return (
    <div className="flex flex-col gap-6">
      {/* Live Polling Status Bar */}
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="relative flex size-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex size-3 rounded-full bg-emerald-500"></span>
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight">
                Live Operations Dashboard
              </span>
              <Badge variant="outline" className="gap-1.5 font-mono text-xs font-normal">
                {isRefreshing ? (
                  <IconRefresh aria-hidden="true" className="size-3 animate-spin text-muted-foreground" />
                ) : (
                  <IconClock aria-hidden="true" className="size-3 text-muted-foreground" />
                )}
                Live metrics (refreshes 5s)
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Last updated {lastRefreshedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
          </div>
        </div>

        {checkInConflictStats.unresolved > 0 ? (
          <Link
            href={`/events/${eventId}/check-in`}
            className={buttonVariants({ variant: "destructive", size: "sm" })}
          >
            <IconAlertTriangle data-icon="inline-start" />
            Resolve {checkInConflictStats.unresolved} Check-in Conflict
            {checkInConflictStats.unresolved > 1 ? "s" : ""}
          </Link>
        ) : null}
      </div>

      {/* Core Glossary Metrics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Confirmed Registrations */}
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              Confirmed Registrations
            </span>
            <IconUsers aria-hidden="true" className="size-4" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight">
            {overview.confirmedRegistrations.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Verified email Attendees
          </p>
        </div>

        {/* Event Capacity */}
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              Event Capacity
            </span>
            <IconTicket aria-hidden="true" className="size-4" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight">
            {overview.eventCapacity.toLocaleString()}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{overview.capacityUtilization.claimed} claimed</span>
            <span>{overview.capacityUtilization.percentage}% used</span>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${overview.capacityUtilization.percentage}%` }}
            />
          </div>
        </div>

        {/* Waitlist Entries */}
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              Waitlist Entries
            </span>
            <IconClock aria-hidden="true" className="size-4" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight">
            {overview.waitlistEntries.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            FIFO queued for capacity
          </p>
        </div>

        {/* Active Check-ins */}
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              Active Check-ins
            </span>
            <IconUserCheck aria-hidden="true" className="size-4" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight">
            {overview.activeCheckIns.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Admitted attendees
          </p>
        </div>

        {/* Attendance Rate */}
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              Attendance Rate
            </span>
            <IconScan aria-hidden="true" className="size-4" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight font-mono">
            {overview.attendanceRate}%
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Check-ins / Confirmed
          </p>
        </div>
      </div>

      {/* Check-ins Over Time Chart */}
      <section className="rounded-xl border bg-card p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold tracking-tight">Check-ins over time</h2>
            <p className="text-xs text-muted-foreground">
              Hourly volume of active attendee check-ins
            </p>
          </div>
          <Badge variant="secondary" className="font-mono text-xs">
            {overview.activeCheckIns} Total
          </Badge>
        </div>

        {checkInsOverTime.length > 0 ? (
          <div className="mt-6 flex flex-col gap-3">
            <div className="flex h-36 items-end gap-2 border-b pb-2 pt-4">
              {(() => {
                const maxCount = Math.max(...checkInsOverTime.map((p) => p.count), 1);
                return checkInsOverTime.map((point) => {
                  const heightPercent = Math.max(8, Math.round((point.count / maxCount) * 100));
                  return (
                    <div
                      key={point.hourIso}
                      className="group flex flex-1 flex-col items-center gap-1.5 h-full justify-end"
                    >
                      <span className="text-xs font-mono font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        {point.count}
                      </span>
                      <div
                        className="w-full max-w-12 rounded-t-sm bg-foreground/85 transition-all group-hover:bg-foreground"
                        style={{ height: `${heightPercent}%` }}
                      />
                      <span className="text-[10px] font-mono text-muted-foreground truncate w-full text-center">
                        {point.label}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        ) : (
          <div className="mt-6 flex h-28 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
            No check-ins recorded yet for this event.
          </div>
        )}
      </section>

      {/* Operational Breakdown Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Invalid & Duplicate Attempts */}
        <div className="flex flex-col justify-between rounded-xl border bg-card p-5 shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-tight">Scan Attempt Outcomes</h3>
              <IconScan aria-hidden="true" className="size-4 text-muted-foreground" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Total scan attempt results
            </p>

            <dl className="mt-4 flex flex-col gap-2.5 text-xs">
              <div className="flex items-center justify-between border-b pb-1.5">
                <dt className="text-muted-foreground">Total Scan Attempts</dt>
                <dd className="font-mono font-semibold">{scanAttemptStats.total}</dd>
              </div>
              <div className="flex items-center justify-between border-b pb-1.5">
                <dt className="flex items-center gap-1.5">
                  <IconCheck aria-hidden="true" className="size-3.5 text-emerald-600" />
                  <span>Accepted</span>
                </dt>
                <dd className="font-mono font-semibold">{scanAttemptStats.accepted}</dd>
              </div>
              <div className="flex items-center justify-between border-b pb-1.5">
                <dt className="flex items-center gap-1.5">
                  <IconAlertTriangle aria-hidden="true" className="size-3.5 text-amber-600" />
                  <span>Duplicates</span>
                </dt>
                <dd className="font-mono font-semibold text-amber-600">{scanAttemptStats.duplicate}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5">
                  <IconAlertTriangle aria-hidden="true" className="size-3.5 text-destructive" />
                  <span>Invalid Attempts</span>
                </dt>
                <dd className="font-mono font-semibold text-destructive">{scanAttemptStats.invalid}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Check-in Conflicts */}
        <div className="flex flex-col justify-between rounded-xl border bg-card p-5 shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-tight">Check-in Conflicts</h3>
              <IconAlertTriangle aria-hidden="true" className="size-4 text-muted-foreground" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Cross-device offline conflict resolution
            </p>

            <dl className="mt-4 flex flex-col gap-2.5 text-xs">
              <div className="flex items-center justify-between border-b pb-1.5">
                <dt className="text-muted-foreground">Unresolved Conflicts</dt>
                <dd className="font-mono font-semibold text-destructive">
                  {checkInConflictStats.unresolved}
                </dd>
              </div>
              <div className="flex items-center justify-between border-b pb-1.5">
                <dt className="text-muted-foreground">Auto-resolved (Timestamp)</dt>
                <dd className="font-mono font-semibold">{checkInConflictStats.resolvedAuto}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Manually Resolved</dt>
                <dd className="font-mono font-semibold">{checkInConflictStats.resolvedManual}</dd>
              </div>
            </dl>
          </div>

          <div className="mt-4 pt-3 border-t">
            <Link
              href={`/events/${eventId}/check-in`}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Check-in operations
              <IconArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
          </div>
        </div>

        {/* Pending Device Synchronization */}
        <div className="flex flex-col justify-between rounded-xl border bg-card p-5 shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-tight">Device Synchronization</h3>
              <IconDeviceMobile aria-hidden="true" className="size-4 text-muted-foreground" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Offline scanner synchronization status
            </p>

            <div className="mt-3">
              {pendingDeviceSync.isSyncPending ? (
                <Badge variant="destructive" className="text-[11px] gap-1">
                  <IconAlertTriangle aria-hidden="true" className="size-3" />
                  Sync Pending / Conflicts
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[11px] gap-1 text-emerald-700 dark:text-emerald-400">
                  <IconCheck aria-hidden="true" className="size-3" />
                  Fully Synchronized
                </Badge>
              )}
            </div>

            <dl className="mt-4 flex flex-col gap-2.5 text-xs">
              <div className="flex items-center justify-between border-b pb-1.5">
                <dt className="text-muted-foreground">Offline Scan Attempts</dt>
                <dd className="font-mono font-semibold">
                  {pendingDeviceSync.offlineScanAttempts}
                </dd>
              </div>
              <div className="flex items-center justify-between border-b pb-1.5">
                <dt className="text-muted-foreground">Low Confidence Clock</dt>
                <dd className="font-mono font-semibold">
                  {pendingDeviceSync.lowConfidenceAttempts}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Unresolved Conflicts</dt>
                <dd className="font-mono font-semibold">
                  {pendingDeviceSync.unresolvedConflicts}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Delivery Outcomes */}
        <div className="flex flex-col justify-between rounded-xl border bg-card p-5 shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-tight">Email Delivery</h3>
              <IconMail aria-hidden="true" className="size-4 text-muted-foreground" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Transactional message outcomes
            </p>

            <dl className="mt-4 flex flex-col gap-2.5 text-xs">
              <div className="flex items-center justify-between border-b pb-1.5">
                <dt className="text-muted-foreground">Delivered / Sent</dt>
                <dd className="font-mono font-semibold text-emerald-600">
                  {deliveryOutcomes.delivered + deliveryOutcomes.sent}
                </dd>
              </div>
              <div className="flex items-center justify-between border-b pb-1.5">
                <dt className="text-muted-foreground">Pending / Submitted</dt>
                <dd className="font-mono font-semibold">
                  {deliveryOutcomes.pending + deliveryOutcomes.submitted}
                </dd>
              </div>
              <div className="flex items-center justify-between border-b pb-1.5">
                <dt className="text-muted-foreground">Transient Failure</dt>
                <dd className="font-mono font-semibold text-amber-600">
                  {deliveryOutcomes.transientFailure}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Permanent Failure</dt>
                <dd className="font-mono font-semibold text-destructive">
                  {deliveryOutcomes.permanentFailure}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
