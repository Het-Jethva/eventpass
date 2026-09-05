export const OFFLINE_EVENT_SNAPSHOT_VERSION = 1 as const;

export type OfflineTicketValidityState =
  | "active"
  | "canceled"
  | "replaced"
  | "expired";

export type OfflineEventSnapshot = {
  version: typeof OFFLINE_EVENT_SNAPSHOT_VERSION;
  generatedAt: string;
  serverTimeAnchor: string;
  event: {
    id: string;
    name: string;
    status: "published" | "canceled";
    eventTimeZone: string;
    checkInOpensAt: string;
    checkInClosesAt: string;
    snapshotFreshAfter: string;
  };
  scannerDevice: {
    id: string;
    label: string;
  };
  authorization: string;
  verificationKeys: Record<string, JsonWebKey>;
  tickets: Array<{
    ticketId: string;
    ticketCode: string;
    displayName: string;
    validityState: OfflineTicketValidityState;
    existingCheckInState: "checked_in" | "not_checked_in";
  }>;
};

export type ScannerPreparationResult =
  | { outcome: "prepared"; snapshot: OfflineEventSnapshot }
  | { outcome: "unauthorized" }
  | { outcome: "event_unavailable" };

export function getSnapshotReadiness(
  snapshot: OfflineEventSnapshot,
  now: Date,
): "ready" | "refresh_required" | "authorization_expired" {
  if (now >= new Date(snapshot.event.checkInClosesAt)) {
    return "authorization_expired";
  }
  if (
    now >= new Date(snapshot.event.snapshotFreshAfter) &&
    new Date(snapshot.generatedAt) < new Date(snapshot.event.snapshotFreshAfter)
  ) {
    return "refresh_required";
  }
  return "ready";
}
