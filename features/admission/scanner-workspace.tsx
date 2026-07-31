"use client";

import { FormEvent, startTransition, useEffect, useRef, useState } from "react";
import {
  IconAlertTriangle,
  IconCamera,
  IconCloudUpload,
  IconKeyboard,
  IconScan,
  IconVolume,
  IconVolumeOff,
} from "@tabler/icons-react";

import {
  quickReverseCheckInAction,
  scanTicketAction,
} from "@/app/scanner/[eventId]/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type {
  AdmissionOutcome,
  AdmissionResult,
} from "@/features/admission/server/admission-application";
import { cn } from "@/lib/utils";
import { admitOffline } from "./offline-scan";
import { offlineScannerStore } from "./offline-snapshot-store";
import { synchronizePendingAttempts } from "./offline-synchronization-client";
import { ScannerPreparation } from "./scanner-preparation";
import { ReasonedCheckInAction } from "./reasoned-check-in-action";
import { PwaUpdateManager } from "./pwa-update-manager";
import { ScanOutcome, outcomePresentation } from "./scan-outcome";

type ScannerControls = { stop: () => void };

function announceFeedback(outcome: AdmissionOutcome, enabled: boolean) {
  if (!enabled || typeof window === "undefined") return;
  try {
    const admitted = outcome === "accepted" || outcome === "provisional";
    navigator.vibrate?.(admitted ? 90 : [80, 60, 80]);
    const AudioContextConstructor = window.AudioContext;
    if (!AudioContextConstructor) return;
    const context = new AudioContextConstructor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = admitted ? 880 : 220;
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.12);
    oscillator.addEventListener("ended", () => void context.close());
  } catch {
    // Admission feedback remains complete through visible text and icon states.
  }
}

export function ScannerWorkspace({
  eventId,
  eventStatus,
  actorRole,
  checkInWindow,
}: {
  eventId: string;
  eventStatus: string;
  actorRole: string;
  checkInWindow: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<ScannerControls | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const submittingRef = useRef(false);
  const syncingRef = useRef(false);
  const [manualCode, setManualCode] = useState("");
  const [result, setResult] = useState<AdmissionResult | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [feedbackEnabled, setFeedbackEnabled] = useState(true);
  const [pendingAttemptCount, setPendingAttemptCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [lastInput, setLastInput] = useState<{
    value: string;
    method: "camera" | "manual";
  } | null>(null);

  useEffect(() => () => controlsRef.current?.stop(), []);

  async function refreshPendingCount() {
    setPendingAttemptCount(
      await offlineScannerStore.countPendingScanAttempts(eventId),
    );
  }

  async function synchronize() {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;
    setSyncing(true);
    setSyncMessage(null);
    try {
      const synchronized = await synchronizePendingAttempts(eventId);
      if (synchronized.acknowledged > 0) {
        const conflicts = synchronized.reconciledOutcomes.filter(
          (outcome) => outcome === "conflict",
        ).length;
        const lostConflicts = synchronized.reconciledOutcomes.filter(
          (outcome) => outcome === "duplicate",
        ).length;
        const acceptedConflicts = synchronized.reconciledOutcomes.filter(
          (outcome) => outcome === "accepted",
        ).length;
        const resolutionParts = [];
        if (conflicts > 0) {
          resolutionParts.push(
            `${conflicts} provisional acceptance${conflicts === 1 ? " requires" : "s require"} Organizer review and ${conflicts === 1 ? "is" : "are"} not globally final`,
          );
        }
        if (lostConflicts > 0) {
          resolutionParts.push(
            `${lostConflicts} provisional acceptance${lostConflicts === 1 ? " did" : "s did"} not become the authoritative check-in`,
          );
        }
        if (acceptedConflicts > 0) {
          resolutionParts.push(
            `${acceptedConflicts} provisional acceptance${acceptedConflicts === 1 ? " is" : "s are"} now authoritative`,
          );
        }
        const resolution =
          resolutionParts.length > 0
            ? ` ${resolutionParts.join("; ")}.`
            : synchronized.changed > 0
              ? ` ${synchronized.changed} reconciled with authoritative server state.`
              : "";
        setSyncMessage(
          `${synchronized.acknowledged} scan attempt${synchronized.acknowledged === 1 ? "" : "s"} synchronized.${resolution}`,
        );
      }
      await refreshPendingCount();
      const cached = await offlineScannerStore.getCachedSnapshot();
      if (cached && cached.event.id === eventId) {
        const purged = await offlineScannerStore.purgeEventIfClosedAndAcknowledged(
          eventId,
          cached.event.checkInClosesAt,
        );
        if (purged) {
          setSyncMessage(
            "Check-in closed and all attempts acknowledged: cached event data purged.",
          );
        }
      }
    } catch {
      setSyncMessage(
        "Pending scan attempts remain safely stored. Retry when connectivity is stable.",
      );
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }

  useEffect(() => {
    const handleOnline = () => void synchronize();
    window.addEventListener("online", handleOnline);
    const initialization = window.setTimeout(() => {
      void refreshPendingCount();
      if (navigator.onLine) void synchronize();
    }, 0);
    const retryInterval = window.setInterval(() => {
      if (navigator.onLine) void synchronize();
    }, 15_000);
    return () => {
      window.clearTimeout(initialization);
      window.clearInterval(retryInterval);
      window.removeEventListener("online", handleOnline);
    };
    // Synchronization is intentionally triggered only on mount and connectivity restoration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    if (result || actionError) resultRef.current?.focus();
  }, [actionError, result]);

  async function submitInput(
    input: string,
    inputMethod: "camera" | "manual",
    overrideReason?: string,
  ) {
    if (submittingRef.current) return null;
    submittingRef.current = true;
    setIsPending(true);
    setActionError(null);
    setResult(null);
    try {
      let nextResult: AdmissionResult;
      if (navigator.onLine) {
        try {
          nextResult = await scanTicketAction({
            eventId,
            clientAttemptId: crypto.randomUUID(),
            input,
            inputMethod,
            overrideReason,
          });
        } catch {
          if (overrideReason) throw new Error("Online access is required for an override.");
          nextResult = await admitOffline({ eventId, input, inputMethod });
        }
      } else {
        nextResult = await admitOffline({ eventId, input, inputMethod });
      }
      setResult(nextResult);
      setLastInput({ value: input, method: inputMethod });
      announceFeedback(nextResult.outcome, feedbackEnabled);
      await refreshPendingCount();
      if (inputMethod === "manual") setManualCode("");
      return nextResult;
    } catch {
      setActionError(
        "The ticket could not be checked. Confirm this device is online, then try again.",
      );
      return null;
    } finally {
      submittingRef.current = false;
      setIsPending(false);
    }
  }

  async function startCamera() {
    setCameraError(null);
    setActionError(null);
    setResult(null);
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader();
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } }, audio: false },
        videoRef.current ?? undefined,
        (decoded) => {
          if (!decoded || submittingRef.current) return;
          controlsRef.current?.stop();
          controlsRef.current = null;
          setCameraActive(false);
          startTransition(() => void submitInput(decoded.getText(), "camera"));
        },
      );
      controlsRef.current = controls;
      setCameraActive(true);
    } catch {
      controlsRef.current?.stop();
      controlsRef.current = null;
      setCameraActive(false);
      setCameraError(
        "The camera is unavailable or was blocked. Type the ticket code below instead.",
      );
    }
  }

  function stopCamera() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setCameraActive(false);
  }

  function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = manualCode.trim();
    if (!value) return;
    startTransition(() => void submitInput(value, "manual"));
  }

  const presentation = result ? outcomePresentation[result.outcome] : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <section className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-xl font-headline text-balance">Scan tickets</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Decisions are settled while this phone is online. Check-in runs{" "}
            {checkInWindow}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Connectivity is reported once, by the block below that actually
              listens for it. This badge used to read a hardcoded "Online" — the
              one place in the product that asserted a network state it had not
              checked, in the surface built around not doing that. */}
          {eventStatus === "canceled" ? (
            <Badge variant="destructive">Event canceled</Badge>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            onClick={() => setFeedbackEnabled((enabled) => !enabled)}
            aria-label={`${feedbackEnabled ? "Disable" : "Enable"} sound and vibration feedback`}
            aria-pressed={feedbackEnabled}
          >
            {feedbackEnabled ? <IconVolume /> : <IconVolumeOff />}
          </Button>
        </div>
      </section>

      <PwaUpdateManager />

      <ScannerPreparation eventId={eventId} />

      {pendingAttemptCount > 0 || syncMessage ? (
        <section
          aria-label="scan attempt synchronization"
          className="flex flex-wrap items-center justify-between gap-3 border-b pb-6"
        >
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {pendingAttemptCount > 0
              ? `${pendingAttemptCount} scan${pendingAttemptCount === 1 ? "" : "s"} waiting to sync from this device.`
              : syncMessage}
          </p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={syncing || pendingAttemptCount === 0}
            onClick={() => void synchronize()}
          >
            {syncing ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <IconCloudUpload data-icon="inline-start" />
            )}
            {syncing ? "Synchronizing…" : "Retry synchronization"}
          </Button>
          {pendingAttemptCount > 0 && syncMessage ? (
            <p className="w-full text-sm text-muted-foreground" aria-live="polite">
              {syncMessage}
            </p>
          ) : null}
        </section>
      ) : null}

      {presentation && result ? (
        // The decision owns the screen. It previously rendered as an 18px
        // headline with a 28px glyph, in normal flow above the camera — so a
        // volunteer had to look away from the viewfinder, and possibly scroll,
        // to find out whether to admit someone.
        //
        // No entrance animation, deliberately: a 200ms fade on a door decision
        // is 200ms of a volunteer not knowing. DESIGN.md § Motion.
        <div
          ref={resultRef}
          tabIndex={-1}
          role="alertdialog"
          aria-label={presentation.title}
          aria-live="assertive"
          className="fixed inset-0 z-50 overflow-y-auto outline-none"
        >
          <ScanOutcome
            outcome={result.outcome}
            attendeeName={result.attendeeName}
            className="min-h-full"
            actions={
              <>
                <Button
                  type="button"
                  size="lg"
                  className="min-h-11"
                  onClick={() => {
                    setResult(null);
                    setLastInput(null);
                  }}
                >
                  <IconScan data-icon="inline-start" />
                  Next scan
                </Button>
                {result.outcome === "accepted" && result.checkInId ? (
                  <ReasonedCheckInAction
                    label={
                      actorRole === "check_in_volunteer"
                        ? "Quick Reversal"
                        : "Reverse check-in"
                    }
                    title="Make this ticket admissible again?"
                    description="The check-in is undone and both it and the scan are kept on record. The ticket can be admitted again."
                    reasonDescription="The correction, and your reason for it, are kept permanently."
                    // Outline, not destructive: this sits on the mint success
                    // surface, where a pink tint reads as an error rather than
                    // as the secondary action it is. The confirm inside the
                    // dialog still carries the weight.
                    variant="outline"
                    action={async (reason) => {
                      const reversed = await quickReverseCheckInAction({
                        eventId,
                        checkInId: result.checkInId!,
                        reason,
                      });
                      return reversed.outcome === "reversed"
                        ? { outcome: "reversed" as const }
                        : reversed;
                    }}
                    onCompleted={() => {
                      setResult(null);
                      setSyncMessage(
                        "Check-in reversed. The ticket can be admitted again.",
                      );
                    }}
                  />
                ) : null}
                {(result.outcome === "outside_window" ||
                  result.outcome === "expired") &&
                actorRole !== "check_in_volunteer" &&
                lastInput ? (
                  <ReasonedCheckInAction
                    label="Admit with override"
                    title="Admit outside the check-in Window?"
                    description="This creates an authoritative check-in outside the configured window. Use it only for an accountable operational exception."
                    reasonDescription="Only organizers can override the window, and the reason is kept permanently."
                    action={async (reason) => {
                      const override = await submitInput(
                        lastInput.value,
                        lastInput.method,
                        reason,
                      );
                      return override?.outcome === "accepted"
                        ? { outcome: "completed" as const }
                        : {
                            outcome: "error" as const,
                            message:
                              "The override was not accepted. Confirm your organizer access and connectivity.",
                          };
                    }}
                  />
                ) : null}
              </>
            }
          />
        </div>
      ) : null}

      {actionError ? (
        <Alert
          ref={resultRef}
          tabIndex={-1}
          variant="destructive"
          aria-live="assertive"
        >
          <IconAlertTriangle />
          <AlertTitle>Check-in unavailable</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      <section aria-labelledby="camera-heading" className="flex flex-col gap-4">
        <div>
          <h2 id="camera-heading" className="font-medium">
            Camera
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Point the rear camera at the ticket QR code.
          </p>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border bg-muted">
          <video
            ref={videoRef}
            muted
            playsInline
            className={cn(
              "size-full object-cover",
              !cameraActive && "invisible",
            )}
            aria-label="Live camera preview"
          />
          {!cameraActive ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <IconCamera
                aria-hidden="true"
                className="size-10 text-muted-foreground"
              />
              <p className="max-w-sm text-sm text-muted-foreground">
                Camera access starts only when you choose Start camera.
              </p>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="lg"
            className="min-h-11"
            onClick={startCamera}
            disabled={cameraActive || isPending}
          >
            <IconCamera data-icon="inline-start" />
            {result ? "Scan next ticket" : "Start camera"}
          </Button>
          {cameraActive ? (
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="min-h-11"
              onClick={stopCamera}
            >
              Stop camera
            </Button>
          ) : null}
        </div>
        {cameraError ? (
          <Alert variant="destructive">
            <IconAlertTriangle />
            <AlertTitle>Use the manual fallback</AlertTitle>
            <AlertDescription>{cameraError}</AlertDescription>
          </Alert>
        ) : null}
      </section>

      <section aria-labelledby="manual-heading" className="border-t pt-6">
        <div className="mb-4">
          <h2
            id="manual-heading"
            className="flex items-center gap-2 font-medium"
          >
            <IconKeyboard aria-hidden="true" className="size-5" />
            Enter ticket code
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Always available when a camera is unsupported, unavailable, or
            inconvenient.
          </p>
        </div>
        <form onSubmit={handleManualSubmit} noValidate>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="ticket-code">ticket code</FieldLabel>
              <Input
                id="ticket-code"
                name="ticketCode"
                value={manualCode}
                onChange={(event) =>
                  setManualCode(event.target.value.toUpperCase())
                }
                placeholder="01234-56789"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={12}
                className="min-h-11 font-mono tracking-code"
              />
              <FieldDescription>
                Ten characters. The dash is optional.
              </FieldDescription>
            </Field>
            <Button
              type="submit"
              size="lg"
              className="min-h-11 sm:self-start"
              disabled={!manualCode.trim() || isPending}
            >
              {isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <IconScan data-icon="inline-start" />
              )}
              {isPending ? "Checking…" : "Check ticket"}
            </Button>
          </FieldGroup>
        </form>
      </section>
    </div>
  );
}
