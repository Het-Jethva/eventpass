"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconCircleCheck,
  IconClock,
  IconRefresh,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { LiveEventMetricsResult } from "@/features/events/event-metrics-policy";
import { cn } from "@/lib/utils";

type LiveMetricsDashboardProps = {
  eventId: string;
  initialMetrics: LiveEventMetricsResult;
};

type Tone = "success" | "warning" | "destructive" | "provisional" | "neutral";

const BAR_TONE: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  provisional: "bg-provisional",
  neutral: "bg-primary",
};

const TEXT_TONE: Record<Tone, string> = {
  success: "text-success-text",
  warning: "text-warning-text",
  destructive: "text-destructive-text",
  provisional: "text-provisional-text",
  neutral: "text-foreground",
};

function percentOf(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}

/**
 * A count is not judgeable on its own — "7 duplicates" means nothing without
 * "of 412 attempts". Every figure on this screen carries its denominator and a
 * proportional bar.
 */
function ProportionRow({
  label,
  value,
  total,
  tone = "neutral",
  unit = "",
}: {
  label: string;
  value: number;
  total: number;
  tone?: Tone;
  unit?: string;
}) {
  const percentage = percentOf(value, total);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono tabular-nums">
          <span className={cn("font-medium", TEXT_TONE[tone])}>
            {value.toLocaleString()}
          </span>
          <span className="text-muted-foreground">
            {" "}
            / {total.toLocaleString()}
            {unit} · {percentage}%
          </span>
        </span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${label}: ${value} of ${total}, ${percentage} percent`}
      >
        <div
          className={cn("h-full transition-all duration-300", BAR_TONE[tone])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function Headline({
  question,
  value,
  of,
  caption,
  tone = "neutral",
}: {
  question: string;
  value: number;
  of: number;
  caption: string;
  tone?: Tone;
}) {
  const percentage = percentOf(value, of);
  return (
    <div className="flex flex-col gap-2 p-5">
      <p className="text-sm text-muted-foreground">{question}</p>
      <p className="flex items-baseline gap-1.5 font-mono tabular-nums">
        <span className="text-4xl font-headline">{value.toLocaleString()}</span>
        <span className="text-lg text-muted-foreground">
          / {of.toLocaleString()}
        </span>
      </p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full transition-all duration-300", BAR_TONE[tone])}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        <span className="font-mono tabular-nums">{percentage}%</span> · {caption}
      </p>
    </div>
  );
}

export function LiveMetricsDashboard({
  eventId,
  initialMetrics,
}: LiveMetricsDashboardProps) {
  const [metrics, setMetrics] = useState<LiveEventMetricsResult>(initialMetrics);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPolling, setIsPolling] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(
    new Date(initialMetrics.refreshedAt),
  );

  useEffect(() => {
    let isMounted = true;
    let controller: AbortController | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function fetchMetrics() {
      if (controller) return;

      const requestController = new AbortController();
      controller = requestController;

      try {
        setIsRefreshing(true);
        const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/live-metrics`, {
          signal: requestController.signal,
        });
        if (res.ok) {
          const data: LiveEventMetricsResult = await res.json();
          if (isMounted) {
            setMetrics(data);
            setLastRefreshedAt(new Date(data.refreshedAt));
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Failed to refresh live metrics:", err);
      } finally {
        if (controller === requestController) {
          controller = null;
          if (isMounted) setIsRefreshing(false);
        }
      }
    }

    function startPolling() {
      if (interval !== null) return;

      interval = setInterval(fetchMetrics, 5000);
      if (isMounted) setIsPolling(true);
    }

    function stopPolling() {
      if (interval !== null) {
        clearInterval(interval);
        interval = null;
      }

      controller?.abort();
      controller = null;
      if (isMounted) {
        setIsRefreshing(false);
        setIsPolling(false);
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        stopPolling();
        return;
      }

      void fetchMetrics();
      startPolling();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    if (document.visibilityState === "visible") {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      isMounted = false;
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [eventId]);

  const {
    overview,
    scanAttemptStats,
    checkInConflictStats,
    pendingDeviceSync,
    deliveryOutcomes,
    checkInsOverTime,
  } = metrics;

  // "Is anything wrong?" is one of the three questions this screen exists to
  // answer, so it is computed rather than left for an organizer to infer by
  // scanning fourteen loose numbers.
  const attention = [
    {
      label: "Conflicts to resolve",
      count: checkInConflictStats.unresolved,
      tone: "destructive" as Tone,
      href: `/events/${eventId}/check-in`,
    },
    {
      label: "Scans waiting to sync",
      count: pendingDeviceSync.offlineScanAttempts,
      tone: "provisional" as Tone,
      href: `/events/${eventId}/check-in`,
    },
    {
      label: "Scans with an unreliable time",
      count: pendingDeviceSync.lowConfidenceAttempts,
      tone: "warning" as Tone,
      href: `/events/${eventId}/audit`,
    },
    {
      label: "Tickets that never arrived",
      count: deliveryOutcomes.permanentFailure,
      tone: "destructive" as Tone,
      href: `/events/${eventId}/registrations`,
    },
  ].filter((item) => item.count > 0);

  const maxHourly = Math.max(...checkInsOverTime.map((p) => p.count), 1);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className={cn(
              "size-2.5 shrink-0 rounded-full transition-colors",
              isPolling ? "bg-success" : "bg-muted-foreground",
            )}
          />
          <Badge variant="outline" className="gap-1.5 font-normal">
            {isRefreshing ? (
              <IconRefresh aria-hidden="true" className="animate-spin" />
            ) : (
              <IconClock aria-hidden="true" />
            )}
            {isPolling ? "Live · refreshes every 5s" : "Paused"}
          </Badge>
          <span className="font-mono text-sm text-muted-foreground tabular-nums">
            {lastRefreshedAt.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
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

      {/* One grouped region with internal dividers, rather than fourteen numbers
          spread across four floating cards. */}
      <section
        aria-label="Event status at a glance"
        className="grid divide-y overflow-hidden rounded-lg border bg-card sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3 lg:divide-x"
      >
        <Headline
          question="How full is it?"
          value={overview.capacityUtilization.claimed}
          of={overview.eventCapacity}
          caption={`${overview.capacityUtilization.remaining.toLocaleString()} places left${
            overview.waitlistEntries > 0
              ? ` · ${overview.waitlistEntries.toLocaleString()} waitlisted`
              : ""
          }`}
          tone={overview.capacityUtilization.percentage >= 100 ? "warning" : "neutral"}
        />
        <div className="border-t sm:border-t-0 sm:border-l lg:border-l-0">
          <Headline
            question="How many have arrived?"
            value={overview.activeCheckIns}
            of={overview.confirmedRegistrations}
            caption="of confirmed registrations checked in"
            tone="success"
          />
        </div>
        <div className="border-t sm:col-span-2 lg:col-span-1 lg:border-t-0 lg:border-l">
          <div className="flex h-full flex-col gap-2 p-5">
            <p className="text-sm text-muted-foreground">Is anything wrong?</p>
            {attention.length === 0 ? (
              <div className="flex flex-1 flex-col justify-center gap-1.5">
                <p className="flex items-center gap-2 text-success-text">
                  <IconCircleCheck aria-hidden="true" className="size-5" />
                  <span className="text-lg font-medium">Nothing to resolve</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  No conflicts, no pending synchronization, no failed
                  deliveries.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {attention.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="group flex items-baseline justify-between gap-3 rounded-md py-1 text-sm hover:underline"
                    >
                      <span className="text-muted-foreground group-hover:text-foreground">
                        {item.label}
                      </span>
                      <span
                        className={cn(
                          "font-mono font-medium tabular-nums",
                          TEXT_TONE[item.tone],
                        )}
                      >
                        {item.count.toLocaleString()}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section
        aria-labelledby="arrivals-heading"
        className="flex flex-col gap-4 rounded-lg border bg-card p-5"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="arrivals-heading" className="font-medium">
            Arrivals by hour
          </h2>
          <p className="font-mono text-sm text-muted-foreground tabular-nums">
            {overview.activeCheckIns.toLocaleString()} total · peak{" "}
            {maxHourly.toLocaleString()}/hr
          </p>
        </div>

        {checkInsOverTime.length > 0 ? (
          <>
            {/*
              Values are always rendered rather than revealed on hover. Hover
              does not exist on a phone, which is where an organizer actually
              watches a door, so the chart previously had no numbers at all
              there — and state must never hide behind hover.

              `<table>` rather than divs so the series is readable by a screen
              reader and keyboard as an ordinary two-column table; the bars are
              presentational decoration layered on the same cells.
            */}
            <table className="w-full">
              <caption className="sr-only">
                Arrivals per hour, in the event time zone
              </caption>
              <thead className="sr-only">
                <tr>
                  <th scope="col">Hour</th>
                  <th scope="col">Arrivals</th>
                </tr>
              </thead>
              <tbody className="flex h-36 items-end gap-2 border-b pt-4 pb-2">
                {checkInsOverTime.map((point) => (
                  <tr
                    key={point.hourIso}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                  >
                    <td className="font-mono text-xs font-medium tabular-nums">
                      {point.count}
                    </td>
                    <td
                      aria-hidden="true"
                      className="w-full max-w-12 rounded-t-sm bg-primary/85"
                      style={{
                        height: `${Math.max(8, Math.round((point.count / maxHourly) * 100))}%`,
                      }}
                    />
                    <th
                      scope="row"
                      className="w-full truncate text-center font-mono text-xs font-normal text-muted-foreground"
                    >
                      {point.label}
                    </th>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nobody has been checked in yet.
          </p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section
          aria-labelledby="scan-outcomes-heading"
          className="flex flex-col gap-4 rounded-lg border bg-card p-5"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="scan-outcomes-heading" className="font-medium">
              Scan outcomes
            </h2>
            <Link
              href={`/events/${eventId}/audit`}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              Audit log
              <IconArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
          </div>
          <p className="font-mono text-sm text-muted-foreground tabular-nums">
            {scanAttemptStats.total.toLocaleString()} attempts ·{" "}
            {scanAttemptStats.offlineCount.toLocaleString()} recorded offline
          </p>
          <div className="flex flex-col gap-3">
            <ProportionRow
              label="Accepted"
              value={scanAttemptStats.accepted}
              total={scanAttemptStats.total}
              tone="success"
            />
            <ProportionRow
              label="Already checked in"
              value={scanAttemptStats.duplicate}
              total={scanAttemptStats.total}
              tone="warning"
            />
            <ProportionRow
              label="Turned away"
              value={
                scanAttemptStats.invalid +
                scanAttemptStats.unknown +
                scanAttemptStats.canceled +
                scanAttemptStats.replaced +
                scanAttemptStats.expired +
                scanAttemptStats.outsideWindow
              }
              total={scanAttemptStats.total}
              tone="destructive"
            />
            <ProportionRow
              label="Raised a conflict"
              value={scanAttemptStats.conflict}
              total={scanAttemptStats.total}
              tone="provisional"
            />
          </div>
        </section>

        <section
          aria-labelledby="delivery-heading"
          className="flex flex-col gap-4 rounded-lg border bg-card p-5"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="delivery-heading" className="font-medium">
              Ticket delivery
            </h2>
            <Link
              href={`/events/${eventId}/registrations`}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              Registrations
              <IconArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
          </div>
          {deliveryOutcomes.total === 0 ? (
            <p className="text-sm text-muted-foreground">
              No ticket emails have been sent yet. They go out as attendees
              confirm their registration.
            </p>
          ) : (
          <>
          <p className="font-mono text-sm text-muted-foreground tabular-nums">
            {deliveryOutcomes.total.toLocaleString()}{" "}
            {deliveryOutcomes.total === 1 ? "message" : "messages"}
          </p>
          <div className="flex flex-col gap-3">
            <ProportionRow
              label="Delivered"
              value={deliveryOutcomes.delivered + deliveryOutcomes.sent}
              total={deliveryOutcomes.total}
              tone="success"
            />
            <ProportionRow
              label="In flight"
              value={deliveryOutcomes.pending + deliveryOutcomes.submitted}
              total={deliveryOutcomes.total}
              tone="neutral"
            />
            <ProportionRow
              label="Retrying"
              value={deliveryOutcomes.transientFailure}
              total={deliveryOutcomes.total}
              tone="warning"
            />
            <ProportionRow
              label="Permanently failed"
              value={deliveryOutcomes.permanentFailure}
              total={deliveryOutcomes.total}
              tone="destructive"
            />
          </div>
          </>
          )}
        </section>
      </div>

      {/* Only when there is something to report. A line reading "0 resolved
          automatically, 0 by an organizer, of 0 total" floated unanchored under
          two panels and told an organizer nothing at all. */}
      {checkInConflictStats.total > 0 ? (
        <p className="text-sm text-muted-foreground">
          Of {checkInConflictStats.total.toLocaleString()} conflicts,{" "}
          {checkInConflictStats.resolvedAuto.toLocaleString()} were resolved
          automatically by timestamp and{" "}
          {checkInConflictStats.resolvedManual.toLocaleString()} by an organizer.
        </p>
      ) : null}
    </div>
  );
}
