import "server-only";

import { and, count, eq, gt, inArray, isNull } from "drizzle-orm";

import {
  buildCheckInsTimeline,
  calculateAttendanceRate,
  computeCapacityUtilization,
  type CheckInConflictStats,
  type DeliveryOutcomeStats,
  type LiveEventMetricsResult,
  type PendingDeviceSyncStats,
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

export async function getOrganizerEventMetrics(
  eventId: string,
  actorUserId: string,
  now = new Date(),
): Promise<LiveEventMetricsResult | null> {
  // Check authorization
  const [assignment] = await db
    .select({ role: eventStaff.role })
    .from(eventStaff)
    .where(
      and(
        eq(eventStaff.eventId, eventId),
        eq(eventStaff.userId, actorUserId),
        inArray(eventStaff.role, ["owner", "organizer", "check_in_volunteer"]),
      ),
    )
    .limit(1);

  if (!assignment) return null;

  const [eventRecord] = await db
    .select({
      id: event.id,
      name: event.name,
      capacity: event.capacity,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      checkInOpensAt: event.checkInOpensAt,
      checkInClosesAt: event.checkInClosesAt,
      eventTimeZone: event.eventTimeZone,
    })
    .from(event)
    .where(eq(event.id, eventId))
    .limit(1);

  if (!eventRecord) return null;

  // Run aggregation queries in parallel
  const [
    regCounts,
    holdsCount,
    offersCount,
    checkInsCount,
    scanOutcomes,
    conflictCounts,
    pendingSyncData,
    emailOutcomes,
    rawCheckInsOverTime,
  ] = await Promise.all([
    // Registration counts by status
    db
      .select({
        status: registration.status,
        count: count(),
      })
      .from(registration)
      .where(eq(registration.eventId, eventId))
      .groupBy(registration.status),

    // Active Capacity Holds
    db
      .select({ count: count() })
      .from(capacityHold)
      .innerJoin(registration, eq(registration.id, capacityHold.registrationId))
      .where(
        and(
          eq(registration.eventId, eventId),
          gt(capacityHold.expiresAt, now),
          isNull(capacityHold.claimedAt),
        ),
      ),

    // Active Admission Offers
    db
      .select({ count: count() })
      .from(admissionOffer)
      .innerJoin(registration, eq(registration.id, admissionOffer.registrationId))
      .where(
        and(
          eq(registration.eventId, eventId),
          eq(admissionOffer.status, "active"),
          gt(admissionOffer.expiresAt, now),
        ),
      ),

    // Active Check-ins
    db
      .select({ count: count() })
      .from(checkIn)
      .where(and(eq(checkIn.eventId, eventId), isNull(checkIn.invalidatedAt))),

    // Scan attempts by outcome and source
    db
      .select({
        outcome: scanAttempt.outcome,
        source: scanAttempt.source,
        timestampConfidence: scanAttempt.timestampConfidence,
        count: count(),
      })
      .from(scanAttempt)
      .where(eq(scanAttempt.eventId, eventId))
      .groupBy(
        scanAttempt.outcome,
        scanAttempt.source,
        scanAttempt.timestampConfidence,
      ),

    // Check-in conflicts by status
    db
      .select({
        status: checkInConflict.status,
        count: count(),
      })
      .from(checkInConflict)
      .where(eq(checkInConflict.eventId, eventId))
      .groupBy(checkInConflict.status),

    // Offline scan attempts count
    db
      .select({ count: count() })
      .from(scanAttempt)
      .where(
        and(
          eq(scanAttempt.eventId, eventId),
          eq(scanAttempt.source, "offline"),
        ),
      ),

    // Email Delivery outcomes for this Event
    db
      .select({
        outcome: emailDelivery.outcome,
        count: count(),
      })
      .from(emailDelivery)
      .where(eq(emailDelivery.eventId, eventId))
      .groupBy(emailDelivery.outcome),

    // Active check-ins with timestamps for timeline grouping
    db
      .select({
        checkedInAt: checkIn.checkedInAt,
      })
      .from(checkIn)
      .where(and(eq(checkIn.eventId, eventId), isNull(checkIn.invalidatedAt))),
  ]);

  // Process Registration status map
  const statusMap = new Map<string, number>();
  for (const row of regCounts) {
    statusMap.set(row.status, Number(row.count));
  }
  const confirmedRegistrations = statusMap.get("confirmed") ?? 0;
  const waitlistEntries = statusMap.get("waitlisted") ?? 0;
  const activeCheckIns = Number(checkInsCount[0]?.count ?? 0);
  const activeHolds = Number(holdsCount[0]?.count ?? 0);
  const activeOffers = Number(offersCount[0]?.count ?? 0);

  const capacityUtilization = computeCapacityUtilization({
    capacity: eventRecord.capacity,
    confirmedCount: confirmedRegistrations,
    activeHoldsCount: activeHolds,
    activeOffersCount: activeOffers,
  });

  const attendanceRate = calculateAttendanceRate({
    confirmedCount: confirmedRegistrations,
    activeCheckInsCount: activeCheckIns,
  });

  // Process Scan Attempts
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

  let lowConfidenceCount = 0;

  for (const row of scanOutcomes) {
    const rowCount = Number(row.count);
    scanStats.total += rowCount;
    if (row.source === "online") scanStats.onlineCount += rowCount;
    if (row.source === "offline") scanStats.offlineCount += rowCount;
    if (row.timestampConfidence === "low") lowConfidenceCount += rowCount;

    switch (row.outcome) {
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
  }

  // Process Conflicts
  const conflictMap = new Map<string, number>();
  for (const row of conflictCounts) {
    conflictMap.set(row.status, Number(row.count));
  }
  const unresolvedConflicts = conflictMap.get("unresolved") ?? 0;
  const resolvedAuto = conflictMap.get("resolved_auto") ?? 0;
  const resolvedManual = conflictMap.get("resolved_manual") ?? 0;
  const totalConflicts = unresolvedConflicts + resolvedAuto + resolvedManual;

  const checkInConflictStats: CheckInConflictStats = {
    total: totalConflicts,
    unresolved: unresolvedConflicts,
    resolvedAuto,
    resolvedManual,
  };

  // Pending Device Sync
  const offlineTotal = Number(pendingSyncData[0]?.count ?? 0);
  const isSyncPending = unresolvedConflicts > 0 || lowConfidenceCount > 0;

  const pendingDeviceSync: PendingDeviceSyncStats = {
    offlineScanAttempts: offlineTotal,
    lowConfidenceAttempts: lowConfidenceCount,
    unresolvedConflicts,
    isSyncPending,
  };

  // Process Email Delivery
  const deliveryStats: DeliveryOutcomeStats = {
    total: 0,
    sent: 0,
    delivered: 0,
    pending: 0,
    submitted: 0,
    transientFailure: 0,
    permanentFailure: 0,
  };

  for (const row of emailOutcomes) {
    const rowCount = Number(row.count);
    deliveryStats.total += rowCount;
    switch (row.outcome) {
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

  // Process Check-ins Over Time
  const checkInsOverTime = buildCheckInsTimeline({
    checkIns: rawCheckInsOverTime,
    timeZone: eventRecord.eventTimeZone,
  });

  return {
    eventId: eventRecord.id,
    eventName: eventRecord.name,
    refreshedAt: now.toISOString(),
    overview: {
      confirmedRegistrations,
      eventCapacity: eventRecord.capacity,
      capacityUtilization,
      waitlistEntries,
      activeCheckIns,
      attendanceRate,
    },
    scanAttemptStats: scanStats,
    checkInConflictStats,
    pendingDeviceSync,
    deliveryOutcomes: deliveryStats,
    checkInsOverTime,
  };
}
