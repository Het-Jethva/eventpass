import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import {
  calculateAttendanceRate,
  computeCapacityUtilization,
  formatCheckInsTimeline,
  type CheckInConflictStats,
  type DeliveryOutcomeStats,
  type LiveEventMetricsResult,
  type OfflineScanStats,
  type ScanAttemptStats,
} from "@/features/events/event-metrics-policy";
import { db } from "@/lib/db";
import {
  admissionOffer,
  capacityHold,
  checkIn,
  checkInConflict,
  emailDelivery,
  event,
  eventStaff,
  registration,
  scanAttempt,
} from "@/lib/db/schema";

export type { LiveEventMetricsResult };

type OperationalAggregateRow = {
  metric: "scan" | "conflict" | "email";
  scan_outcome: string | null;
  scan_source: string | null;
  timestamp_confidence: string | null;
  conflict_status: string | null;
  delivery_outcome: string | null;
  row_count: number | string;
};

type TimelineAggregateRow = {
  hour_start: Date | string;
  check_in_count: number | string;
};

export async function getOrganizerEventMetrics(
  eventId: string,
  actorUserId: string,
  now = new Date(),
): Promise<LiveEventMetricsResult | null> {
  // Read 1: authorize the actor and load the Event metadata needed by every
  // following read. Joining through Event keeps the authorization boundary
  // tied to the same Event whose metrics are returned.
  const [authorizedEvent] = await db
    .select({
      id: event.id,
      name: event.name,
      capacity: event.capacity,
      checkInOpensAt: event.checkInOpensAt,
      checkInClosesAt: event.checkInClosesAt,
      eventTimeZone: event.eventTimeZone,
    })
    .from(eventStaff)
    .innerJoin(event, eq(event.id, eventStaff.eventId))
    .where(
      and(
        eq(event.id, eventId),
        eq(eventStaff.userId, actorUserId),
        inArray(eventStaff.role, ["owner", "organizer", "check_in_volunteer"]),
      ),
    )
    .limit(1);

  if (!authorizedEvent) return null;

  // The three aggregate reads below intentionally stay separate. Each has one
  // operational concern and a stable Event predicate, while the loader still
  // uses four round trips rather than one query per displayed number.
  const [capacityResult, operationalResult, timelineResult] = await Promise.all([
    // Read 2: capacity, Registration, hold, offer, and active Check-in totals.
    db
      .select({
        confirmed_registrations: sql<number>`(
          select count(*)::int
          from ${registration} as confirmed_registration
          where confirmed_registration.event_id = ${authorizedEvent.id}
            and confirmed_registration.status = 'confirmed'
        )`,
        waitlist_entries: sql<number>`(
          select count(*)::int
          from ${registration} as waitlisted_registration
          where waitlisted_registration.event_id = ${authorizedEvent.id}
            and waitlisted_registration.status = 'waitlisted'
        )`,
        active_holds: sql<number>`(
          select count(*)::int
          from ${capacityHold} as active_hold
          inner join ${registration} as held_registration
            on held_registration.id = active_hold.registration_id
          where held_registration.event_id = ${authorizedEvent.id}
            and active_hold.claimed_at is null
            and active_hold.expires_at > ${now}
        )`,
        active_offers: sql<number>`(
          select count(*)::int
          from ${admissionOffer} as active_offer
          inner join ${registration} as offered_registration
            on offered_registration.id = active_offer.registration_id
          where offered_registration.event_id = ${authorizedEvent.id}
            and active_offer.status = 'active'
            and active_offer.expires_at > ${now}
        )`,
        active_check_ins: sql<number>`(
          select count(*)::int
          from ${checkIn} as active_check_in
          where active_check_in.event_id = ${authorizedEvent.id}
            and active_check_in.invalidated_at is null
        )`,
      })
      .from(event)
      .where(eq(event.id, authorizedEvent.id))
      .limit(1),

    // Read 3: Scan Attempt, Check-in Conflict, and Email Delivery aggregates.
    // The normalized UNION keeps these histories in one readable operational
    // read without joining unrelated one-to-many tables together.
    db.execute(sql`
      with scan_aggregates as (
        select
          'scan'::text as metric,
          attempts.outcome::text as scan_outcome,
          attempts.source::text as scan_source,
          attempts.timestamp_confidence::text as timestamp_confidence,
          null::text as conflict_status,
          null::text as delivery_outcome,
          count(*)::int as row_count
        from ${scanAttempt} as attempts
        where attempts.event_id = ${authorizedEvent.id}
        group by attempts.outcome, attempts.source, attempts.timestamp_confidence
      ),
      conflict_aggregates as (
        select
          'conflict'::text as metric,
          null::text as scan_outcome,
          null::text as scan_source,
          null::text as timestamp_confidence,
          conflicts.status::text as conflict_status,
          null::text as delivery_outcome,
          count(*)::int as row_count
        from ${checkInConflict} as conflicts
        where conflicts.event_id = ${authorizedEvent.id}
        group by conflicts.status
      ),
      delivery_aggregates as (
        select
          'email'::text as metric,
          null::text as scan_outcome,
          null::text as scan_source,
          null::text as timestamp_confidence,
          null::text as conflict_status,
          deliveries.outcome::text as delivery_outcome,
          count(*)::int as row_count
        from ${emailDelivery} as deliveries
        where deliveries.event_id = ${authorizedEvent.id}
        group by deliveries.outcome
      )
      select * from scan_aggregates
      union all
      select * from conflict_aggregates
      union all
      select * from delivery_aggregates
    `),

    // Read 4: bucket active Check-ins in Postgres using the Event's IANA time
    // zone. date_trunc's time-zone argument preserves distinct fall-back hours
    // because each bucket remains a timestamptz instant.
    db.execute(sql`
      with check_in_hours as (
        select date_trunc(
          'hour',
          active_check_in.checked_in_at,
          ${authorizedEvent.eventTimeZone}
        ) as hour_start
        from ${checkIn} as active_check_in
        where active_check_in.event_id = ${authorizedEvent.id}
          and active_check_in.invalidated_at is null
      )
      select
        hour_start,
        count(*)::int as check_in_count
      from check_in_hours
      group by hour_start
      order by hour_start
    `),
  ]);

  const [capacityAggregates] = capacityResult;
  const confirmedRegistrations = Number(
    capacityAggregates?.confirmed_registrations ?? 0,
  );
  const waitlistEntries = Number(capacityAggregates?.waitlist_entries ?? 0);
  const activeHolds = Number(capacityAggregates?.active_holds ?? 0);
  const activeOffers = Number(capacityAggregates?.active_offers ?? 0);
  const activeCheckIns = Number(capacityAggregates?.active_check_ins ?? 0);

  const capacityUtilization = computeCapacityUtilization({
    capacity: authorizedEvent.capacity,
    confirmedCount: confirmedRegistrations,
    activeHoldsCount: activeHolds,
    activeOffersCount: activeOffers,
  });

  const attendanceRate = calculateAttendanceRate({
    confirmedCount: confirmedRegistrations,
    activeCheckInsCount: activeCheckIns,
  });

  const scanStats: ScanAttemptStats = {
    total: 0,
    accepted: 0,
    duplicate: 0,
    invalid: 0,
    unknown: 0,
    canceled: 0,
    replaced: 0,
    expired: 0,
    outsideWindow: 0,
    conflict: 0,
    onlineCount: 0,
    offlineCount: 0,
  };
  let lowConfidenceReceived = 0;

  const operationalRows = (operationalResult.rows ?? []) as unknown as
    OperationalAggregateRow[];
  const conflictMap = new Map<string, number>();
  const deliveryStats: DeliveryOutcomeStats = {
    total: 0,
    sent: 0,
    delivered: 0,
    pending: 0,
    submitted: 0,
    transientFailure: 0,
    permanentFailure: 0,
  };

  for (const row of operationalRows) {
    const rowCount = Number(row.row_count);

    if (row.metric === "scan") {
      scanStats.total += rowCount;
      if (row.scan_source === "online") scanStats.onlineCount += rowCount;
      if (row.scan_source === "offline") scanStats.offlineCount += rowCount;
      if (row.timestamp_confidence === "low") {
        lowConfidenceReceived += rowCount;
      }

      switch (row.scan_outcome) {
        case "accepted":
          scanStats.accepted += rowCount;
          break;
        case "duplicate":
          scanStats.duplicate += rowCount;
          break;
        case "invalid":
          scanStats.invalid += rowCount;
          break;
        case "unknown":
          scanStats.unknown += rowCount;
          break;
        case "canceled":
          scanStats.canceled += rowCount;
          break;
        case "replaced":
          scanStats.replaced += rowCount;
          break;
        case "expired":
          scanStats.expired += rowCount;
          break;
        case "outside_window":
          scanStats.outsideWindow += rowCount;
          break;
        case "conflict":
          scanStats.conflict += rowCount;
          break;
      }
      continue;
    }

    if (row.metric === "conflict" && row.conflict_status) {
      conflictMap.set(
        row.conflict_status,
        (conflictMap.get(row.conflict_status) ?? 0) + rowCount,
      );
      continue;
    }

    if (row.metric === "email") {
      deliveryStats.total += rowCount;
      switch (row.delivery_outcome) {
        case "sent":
          deliveryStats.sent += rowCount;
          break;
        case "delivered":
          deliveryStats.delivered += rowCount;
          break;
        case "pending":
          deliveryStats.pending += rowCount;
          break;
        case "submitted":
          deliveryStats.submitted += rowCount;
          break;
        case "transient_failure":
          deliveryStats.transientFailure += rowCount;
          break;
        case "permanent_failure":
          deliveryStats.permanentFailure += rowCount;
          break;
      }
    }
  }

  const unresolvedConflicts = conflictMap.get("unresolved") ?? 0;
  const checkInConflictStats: CheckInConflictStats = {
    total:
      unresolvedConflicts +
      (conflictMap.get("resolved_auto") ?? 0) +
      (conflictMap.get("resolved_manual") ?? 0),
    unresolved: unresolvedConflicts,
    resolvedAuto: conflictMap.get("resolved_auto") ?? 0,
    resolvedManual: conflictMap.get("resolved_manual") ?? 0,
  };

  const offlineScanStats: OfflineScanStats = {
    received: scanStats.offlineCount,
    lowConfidenceReceived,
  };

  const timelineRows = (timelineResult.rows ?? []) as unknown as
    TimelineAggregateRow[];
  const checkInsOverTime = formatCheckInsTimeline({
    buckets: timelineRows.map((row) => ({
      hourStart: new Date(row.hour_start),
      count: Number(row.check_in_count),
    })),
    timeZone: authorizedEvent.eventTimeZone,
  });

  return {
    eventId: authorizedEvent.id,
    eventName: authorizedEvent.name,
    refreshedAt: now.toISOString(),
    checkInWindow: {
      opensAt: authorizedEvent.checkInOpensAt.toISOString(),
      closesAt: authorizedEvent.checkInClosesAt.toISOString(),
    },
    overview: {
      confirmedRegistrations,
      eventCapacity: authorizedEvent.capacity,
      capacityUtilization,
      waitlistEntries,
      activeCheckIns,
      attendanceRate,
    },
    scanAttemptStats: scanStats,
    checkInConflictStats,
    offlineScanStats,
    deliveryOutcomes: deliveryStats,
    checkInsOverTime,
  };
}
