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
  provisionalOfflineAttempts: number;
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
