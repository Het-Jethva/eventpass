export type EventMetricsOverview = {
  confirmedRegistrations: number;
  eventCapacity: number;
  capacityUtilization: {
    claimed: number;
    remaining: number;
    percentage: number;
  };
  waitlistEntries: number;
  activeCheckIns: number;
  attendanceRate: number;
};

export type ScanAttemptStats = {
  total: number;
  accepted: number;
  duplicate: number;
  invalid: number;
  unknown: number;
  canceled: number;
  replaced: number;
  expired: number;
  outsideWindow: number;
  conflict: number;
  onlineCount: number;
  offlineCount: number;
};

export type CheckInConflictStats = {
  total: number;
  unresolved: number;
  resolvedAuto: number;
  resolvedManual: number;
};

export type OfflineScanStats = {
  received: number;
  lowConfidenceReceived: number;
};

export type DeliveryOutcomeStats = {
  total: number;
  sent: number;
  delivered: number;
  pending: number;
  submitted: number;
  transientFailure: number;
  permanentFailure: number;
};

export type HourlyCheckInPoint = {
  label: string;
  hourIso: string;
  count: number;
};

export type LiveEventMetricsResult = {
  eventId: string;
  eventName: string;
  refreshedAt: string;
  checkInWindow: {
    opensAt: string;
    closesAt: string;
  };
  overview: EventMetricsOverview;
  scanAttemptStats: ScanAttemptStats;
  checkInConflictStats: CheckInConflictStats;
  offlineScanStats: OfflineScanStats;
  deliveryOutcomes: DeliveryOutcomeStats;
  checkInsOverTime: HourlyCheckInPoint[];
};

export function calculateAttendanceRate({
  confirmedCount,
  activeCheckInsCount,
}: {
  confirmedCount: number;
  activeCheckInsCount: number;
}): number {
  if (confirmedCount <= 0) return 0;
  const rate = (activeCheckInsCount / confirmedCount) * 100;
  return Math.min(100, Math.round(rate));
}

export function formatCheckInsTimeline({
  buckets,
  timeZone,
}: {
  buckets: { hourStart: Date; count: number }[];
  timeZone: string;
}): HourlyCheckInPoint[] {
  const hourLabelFormatter = new Intl.DateTimeFormat("en", {
    hour: "numeric",
    hour12: true,
    timeZone,
  });
  const eventTimeFormatter = new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    hourCycle: "h23",
    timeZone,
  });
  const disambiguatedHourLabelFormatter = new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
    timeZoneName: "short",
  });

  const localHourKeys = buckets.map(({ hourStart }) =>
    eventTimeFormatter
      .formatToParts(hourStart)
      .filter((part) => ["year", "month", "day", "hour"].includes(part.type))
      .map((part) => part.value)
      .join("-"),
  );
  const localHourKeyCounts = new Map<string, number>();
  for (const key of localHourKeys) {
    localHourKeyCounts.set(key, (localHourKeyCounts.get(key) ?? 0) + 1);
  }

  return buckets.map(({ hourStart, count }, index) => {
    const localHourKey = localHourKeys[index];
    const label =
      localHourKey && localHourKeyCounts.get(localHourKey)! > 1
        ? disambiguatedHourLabelFormatter.format(hourStart)
        : hourLabelFormatter.format(hourStart);

    return {
      count,
      hourIso: hourStart.toISOString(),
      label,
    };
  });
}

export function computeCapacityUtilization({
  capacity,
  confirmedCount,
  activeHoldsCount,
  activeOffersCount,
}: {
  capacity: number;
  confirmedCount: number;
  activeHoldsCount: number;
  activeOffersCount: number;
}) {
  const claimed = confirmedCount + activeHoldsCount + activeOffersCount;
  const remaining = Math.max(0, capacity - claimed);
  const percentage = capacity > 0 ? Math.min(100, Math.round((claimed / capacity) * 100)) : 0;
  return { claimed, remaining, percentage };
}
