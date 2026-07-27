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

export type PendingDeviceSyncStats = {
  offlineScanAttempts: number;
  lowConfidenceAttempts: number;
  unresolvedConflicts: number;
  isSyncPending: boolean;
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
  overview: EventMetricsOverview;
  scanAttemptStats: ScanAttemptStats;
  checkInConflictStats: CheckInConflictStats;
  pendingDeviceSync: PendingDeviceSyncStats;
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

export function buildCheckInsTimeline({
  checkIns,
  timeZone,
}: {
  checkIns: { checkedInAt: Date }[];
  timeZone: string;
}): HourlyCheckInPoint[] {
  const buckets = new Map<
    string,
    {
      count: number;
      earliestCheckedInAt: number;
      hourIso: string;
      label: string;
    }
  >();

  const eventTimeFormatter = new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
    timeZone,
  });
  const hourLabelFormatter = new Intl.DateTimeFormat("en", {
    hour: "numeric",
    hour12: true,
    timeZone,
  });

  for (const { checkedInAt } of checkIns) {
    let year: string | undefined;
    let month: string | undefined;
    let day: string | undefined;
    let hour: string | undefined;
    let minute: string | undefined;
    let second: string | undefined;

    for (const part of eventTimeFormatter.formatToParts(checkedInAt)) {
      switch (part.type) {
        case "year":
          year = part.value;
          break;
        case "month":
          month = part.value;
          break;
        case "day":
          day = part.value;
          break;
        case "hour":
          hour = part.value;
          break;
        case "minute":
          minute = part.value;
          break;
        case "second":
          second = part.value;
          break;
      }
    }

    if (!year || !month || !day || !hour || !minute || !second) {
      throw new Error("Unable to derive Event Time Zone fields for Check-in");
    }

    const bucketKey = `${year}-${month}-${day}T${hour}`;
    const checkedInAtMs = checkedInAt.getTime();
    const withinHourMs =
      (Number(minute) * 60 + Number(second)) * 1_000 + checkedInAt.getUTCMilliseconds();
    const hourIso = new Date(checkedInAtMs - withinHourMs).toISOString();
    const existing = buckets.get(bucketKey);

    if (existing) {
      existing.count += 1;
      if (checkedInAtMs < existing.earliestCheckedInAt) {
        existing.earliestCheckedInAt = checkedInAtMs;
        existing.hourIso = hourIso;
      }
    } else {
      buckets.set(bucketKey, {
        count: 1,
        earliestCheckedInAt: checkedInAtMs,
        hourIso,
        label: hourLabelFormatter.format(checkedInAt),
      });
    }
  }

  const points = Array.from(buckets.values(), ({ count, hourIso, label }) => ({
    count,
    hourIso,
    label,
  }));
  points.sort((a, b) => a.hourIso.localeCompare(b.hourIso));

  return points;
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
