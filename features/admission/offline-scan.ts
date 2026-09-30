"use client";

import { classifyTicketCredential } from "../tickets/ticket-credential";
import { verifyOfflineTicket } from "../tickets/verify-offline-ticket";
import type {
  AdmissionOutcome,
  AdmissionResult,
} from "./server/admission-application";
import { getSnapshotReadiness } from "./offline-snapshot";
import { refuseOfflineCredential } from "./offline-presentation";
import { decideSnapshotTicketOutcome, parseStoredSnapshotValidity } from "./check-in-validity";
import {
  offlineScannerStore,
  type PendingScanAttemptRecord,
} from "./offline-snapshot-store";

type OfflineAdmissionOutcome = AdmissionOutcome | "provisional";

async function digestInput(input: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function resultFor(
  outcome: OfflineAdmissionOutcome,
  attendeeName?: string,
): AdmissionResult {
  return { outcome, attendeeName };
}

type OfflineScannerLookup = {
  getCachedSnapshot: typeof offlineScannerStore.getCachedSnapshot;
  captureAttemptTiming: typeof offlineScannerStore.captureAttemptTiming;
  getCachedTicket: typeof offlineScannerStore.getCachedTicket;
  getCachedTicketByCode: typeof offlineScannerStore.getCachedTicketByCode;
  hasLocallyAcceptedTicket: typeof offlineScannerStore.hasLocallyAcceptedTicket;
  savePendingScanAttempt: typeof offlineScannerStore.savePendingScanAttempt;
};

export async function admitOffline(
  values: {
    eventId: string;
    input: string;
    inputMethod: "camera" | "manual";
    clientAttemptId?: string;
  },
  store: OfflineScannerLookup = offlineScannerStore,
): Promise<AdmissionResult> {
  const snapshot = await store.getCachedSnapshot();
  if (!snapshot || snapshot.event.id !== values.eventId) {
    return resultFor("unauthorized");
  }

  const timing = await store.captureAttemptTiming(values.eventId);
  if (!timing) return resultFor("unauthorized");
  const estimatedServerTime = new Date(
    new Date(timing.serverTimeAnchor).getTime() + timing.monotonicElapsedMs,
  );
  if (getSnapshotReadiness(snapshot, estimatedServerTime) === "refresh_required") {
    return resultFor("snapshot_stale");
  }
  const credential = classifyTicketCredential(values.input);
  const ticketCode = credential.kind === "code" ? credential.code : null;
  const ticketPayload =
    credential.kind === "code"
      ? null
      : await verifyOfflineTicket(credential.jws, snapshot.verificationKeys);
  const ticket = ticketCode
    ? await store.getCachedTicketByCode(values.eventId, ticketCode)
    : ticketPayload?.eventId === values.eventId
      ? await store.getCachedTicket(values.eventId, ticketPayload.ticketId)
      : undefined;
  const refusal = refuseOfflineCredential({
    eventId: values.eventId,
    ticketCode,
    payloadEventId: ticketPayload?.eventId ?? null,
    ticketFound: Boolean(ticket),
  });
  let outcome: OfflineAdmissionOutcome;
  if (refusal) {
    outcome = refusal;
  } else if (!ticket) {
    outcome = "unknown";
  } else {
    const storedValidity = parseStoredSnapshotValidity(ticket.validityState);
    const snapshotOutcome =
      storedValidity === "invalid"
        ? "invalid"
        : decideSnapshotTicketOutcome({
            validityState: storedValidity,
            attemptedAt: estimatedServerTime,
            checkInOpensAt: new Date(snapshot.event.checkInOpensAt),
            checkInClosesAt: new Date(snapshot.event.checkInClosesAt),
          });
    if (snapshotOutcome) {
      outcome = snapshotOutcome;
    } else if (ticket.existingCheckInState === "conflict") {
      return resultFor("conflict", ticket.displayName);
    } else if (
      ticket.existingCheckInState === "checked_in" ||
      (await store.hasLocallyAcceptedTicket(values.eventId, ticket.ticketId))
    ) {
      outcome = "duplicate";
    } else {
      outcome = "provisional";
    }
  }

  const attempt: PendingScanAttemptRecord = {
    id: values.clientAttemptId ?? crypto.randomUUID(),
    eventId: values.eventId,
    ticketId: ticket?.ticketId ?? null,
    inputDigest: await digestInput(ticketCode ?? values.input),
    inputMethod: values.inputMethod,
    capturedOutcome: outcome,
    deviceRecordedAt: new Date().toISOString(),
    serverTimeAnchor: timing.serverTimeAnchor,
    monotonicElapsedMs: timing.monotonicElapsedMs,
    timestampConfidence: timing.timestampConfidence,
    signedTicket: ticket && !ticketCode ? values.input : null,
    authorization: snapshot.authorization,
    scannerDeviceId: snapshot.scannerDevice.id,
  };
  await store.savePendingScanAttempt(attempt);
  return resultFor(outcome, ticket?.displayName);
}

export type { OfflineAdmissionOutcome };
