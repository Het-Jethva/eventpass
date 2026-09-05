"use client";

import { normalizeTicketCode } from "../tickets/ticket-code";
import type {
  AdmissionOutcome,
  AdmissionResult,
} from "./server/admission-application";
import { getSnapshotReadiness } from "./offline-snapshot";
import {
  offlineScannerStore,
  type PendingScanAttemptRecord,
} from "./offline-snapshot-store";

type OfflineAdmissionOutcome = AdmissionOutcome | "provisional";

type DecodedTicket = {
  eventId: string;
  ticketId: string;
};

function decodeBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Malformed JWS.");
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJson(value: string): unknown {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

export async function verifyOfflineTicket(
  compactJws: string,
  keys: Record<string, JsonWebKey>,
): Promise<DecodedTicket | null> {
  try {
    const segments = compactJws.split(".");
    if (segments.length !== 3) return null;
    const [protectedSegment, payloadSegment, signatureSegment] = segments;
    if (!protectedSegment || !payloadSegment || !signatureSegment) return null;
    const header = decodeJson(protectedSegment);
    const payload = decodeJson(payloadSegment);
    if (
      typeof header !== "object" ||
      header === null ||
      Object.keys(header).sort().join(",") !== "alg,kid,typ" ||
      !("alg" in header) ||
      header.alg !== "ES256" ||
      !("kid" in header) ||
      typeof header.kid !== "string" ||
      !("typ" in header) ||
      header.typ !== "eventpass-ticket+jws" ||
      typeof payload !== "object" ||
      payload === null ||
      Object.keys(payload).sort().join(",") !== "eventId,ticketId,v" ||
      !("v" in payload) ||
      payload.v !== 1 ||
      !("eventId" in payload) ||
      typeof payload.eventId !== "string" ||
      !("ticketId" in payload) ||
      typeof payload.ticketId !== "string"
    ) {
      return null;
    }
    const jwk = keys[header.kid];
    if (!jwk) return null;
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      decodeBase64Url(signatureSegment),
      new TextEncoder().encode(`${protectedSegment}.${payloadSegment}`),
    );
    return valid
      ? { eventId: payload.eventId, ticketId: payload.ticketId }
      : null;
  } catch {
    return null;
  }
}

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
  if (getSnapshotReadiness(snapshot, estimatedServerTime) !== "ready") {
    return resultFor("unauthorized");
  }
  const ticketCode = normalizeTicketCode(values.input);
  const ticketPayload = ticketCode
    ? null
    : await verifyOfflineTicket(values.input, snapshot.verificationKeys);
  const ticket = ticketCode
    ? await store.getCachedTicketByCode(values.eventId, ticketCode)
    : ticketPayload?.eventId === values.eventId
      ? await store.getCachedTicket(values.eventId, ticketPayload.ticketId)
      : undefined;
  let outcome: OfflineAdmissionOutcome;
  if (ticketCode && !ticket) {
    outcome = "unknown";
  } else if (!ticketCode && !ticketPayload) {
    outcome = "invalid";
  } else if (!ticket) {
    outcome = "unknown";
  } else if (
    snapshot.event.status === "canceled" ||
    ticket.validityState === "canceled"
  ) {
    outcome = "canceled";
  } else if (ticket.validityState === "replaced") {
    outcome = "replaced";
  } else if (ticket.validityState === "expired") {
    outcome = "expired";
  } else if (estimatedServerTime >= new Date(snapshot.event.checkInClosesAt)) {
    outcome = "expired";
  } else if (estimatedServerTime < new Date(snapshot.event.checkInOpensAt)) {
    outcome = "outside_window";
  } else if (
    ticket.existingCheckInState === "checked_in" ||
    (await store.hasLocallyAcceptedTicket(values.eventId, ticket.ticketId))
  ) {
    outcome = "duplicate";
  } else {
    outcome = "provisional";
  }

  const attempt: PendingScanAttemptRecord = {
    id: crypto.randomUUID(),
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
