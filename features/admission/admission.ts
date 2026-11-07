import type { StoredScanOutcome } from "./scan-outcomes";

export type AdmissionOutcome =
  | Exclude<StoredScanOutcome, "not_checked_in">
  | "provisional"
  | "event_unavailable"
  | "snapshot_stale"
  | "unauthorized";

export type AdmissionResult = {
  outcome: AdmissionOutcome;
  ticketId?: string;
  attendeeName?: string;
  checkedInAt?: Date;
  checkInId?: string;
};

export type AdmissionInput = {
  eventId: string;
  actorUserId: string;
  clientAttemptId: string;
  input: string;
  inputMethod: "camera" | "manual";
  overrideReason?: string;
};

export type OfflineScanAttemptInput = {
  id: string;
  eventId: string;
  ticketId: string | null;
  inputDigest: string;
  inputMethod: AdmissionInput["inputMethod"];
  capturedOutcome:
    | Exclude<StoredScanOutcome, "accepted" | "conflict" | "not_checked_in">
    | "provisional";
  deviceRecordedAt: string;
  serverTimeAnchor: string;
  monotonicElapsedMs: number;
  timestampConfidence: "high" | "low";
  signedTicket: string | null;
  scannerDeviceId: string;
};

export type OfflineSynchronizationResult = {
  id: string;
  ticketId: string | null;
  outcome: StoredScanOutcome;
  changed: boolean;
};
