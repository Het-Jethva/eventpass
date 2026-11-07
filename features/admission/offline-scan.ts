"use client";

import { classifyTicketCredential } from "../tickets/ticket-credential";
import { verifyOfflineTicket } from "../tickets/verify-offline-ticket";
import type { AdmissionInput, AdmissionResult } from "./admission";
import { offlineScannerStore } from "./offline-snapshot-store";

async function digestInput(input: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function admitOffline(
  values: Omit<AdmissionInput, "actorUserId" | "overrideReason">,
  store: Pick<
    typeof offlineScannerStore,
    "getVerificationContext" | "recordScan"
  > = offlineScannerStore,
): Promise<AdmissionResult> {
  const credential = classifyTicketCredential(values.input);
  const inputDigest = await digestInput(
    credential.kind === "code" ? credential.code : values.input,
  );

  // WebCrypto must finish before opening the IndexedDB transaction. If another
  // tab replaces the snapshot meanwhile, verify against the new keys once.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const context = await store.getVerificationContext(values.eventId);
    if (!context) return { outcome: "unauthorized" };
    const payload =
      credential.kind === "jws"
        ? await verifyOfflineTicket(credential.jws, context.verificationKeys)
        : null;
    const result = await store.recordScan({
      eventId: values.eventId,
      clientAttemptId: values.clientAttemptId,
      inputMethod: values.inputMethod,
      inputDigest,
      authorization: context.authorization,
      credential:
        credential.kind === "code"
          ? credential
          : payload
            ? { kind: "signed", ...payload, signedTicket: credential.jws }
            : { kind: "invalid" },
    });
    if (result.outcome !== "snapshot_changed") return result;
  }
  return { outcome: "snapshot_stale" };
}
