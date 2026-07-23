"use client";

import { FormEvent, startTransition, useEffect, useRef, useState } from "react";
import {
  IconAlertTriangle,
  IconCalendarCancel,
  IconCamera,
  IconCircleCheck,
  IconClockExclamation,
  IconClockX,
  IconCloudUpload,
  IconCopyCheck,
  IconHelpHexagon,
  IconKeyboard,
  IconLock,
  IconRefresh,
  IconScan,
  IconVolume,
  IconVolumeOff,
  type Icon,
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

type ScannerControls = { stop: () => void };

const outcomePresentation: Record<
  AdmissionOutcome,
  { title: string; description: string; icon: Icon; destructive: boolean }
> = {
  accepted: {
    title: "Checked in",
    description:
      "Admission recorded. The Ticket cannot be used again while this Check-in is active.",
    icon: IconCircleCheck,
    destructive: false,
  },
  provisional: {
    title: "Provisionally checked in",
    description:
      "Stored on this device. Synchronization will establish the authoritative Check-in when connectivity returns.",
    icon: IconCloudUpload,
    destructive: false,
  },
  duplicate: {
    title: "Already checked in",
    description:
      "This Ticket already has an active Check-in. This attempt was recorded as a duplicate.",
    icon: IconCopyCheck,
    destructive: false,
  },
  invalid: {
    title: "Invalid Ticket",
    description:
      "The QR representation or Ticket Code is malformed or its signature is not valid.",
    icon: IconAlertTriangle,
    destructive: true,
  },
  unknown: {
    title: "Ticket not found",
    description:
      "No Ticket for this Event matches that QR representation or Ticket Code.",
    icon: IconHelpHexagon,
    destructive: true,
  },
  canceled: {
    title: "Ticket canceled",
    description: "This Ticket or Event was canceled and cannot be admitted.",
    icon: IconCalendarCancel,
    destructive: true,
  },
  replaced: {
    title: "Ticket replaced",
    description:
      "A newer Ticket was issued for this Registration. Ask the Attendee for the replacement.",
    icon: IconRefresh,
    destructive: true,
  },
  expired: {
    title: "Check-in closed",
    description:
      "The Check-in Window has ended, so this Ticket is no longer admissible.",
    icon: IconClockX,
    destructive: true,
  },
  outside_window: {
    title: "Check-in not open",
    description:
      "This Ticket is valid, but the Check-in Window has not opened yet.",
    icon: IconClockExclamation,
    destructive: true,
  },
  unauthorized: {
    title: "Scanner access unavailable",
    description:
      "Your current staff access does not authorize admission for this Event.",
    icon: IconLock,
    destructive: true,
  },
};

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
            `${lostConflicts} provisional acceptance${lostConflicts === 1 ? " did" : "s did"} not become the authoritative Check-in`,
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
          `${synchronized.acknowledged} Scan Attempt${synchronized.acknowledged === 1 ? "" : "s"} synchronized.${resolution}`,
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
            "Check-in closed and all attempts acknowledged: cached Event data purged.",
          );
        }
      }
    } catch {
      setSyncMessage(
        "Pending Scan Attempts remain safely stored. Retry when connectivity is stable.",
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
        "The Ticket could not be checked. Confirm this device is online, then try again.",
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
        "Camera scanning is unavailable or permission was denied. Enter the Ticket Code below instead.",
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
  const ResultIcon = presentation?.icon ?? IconScan;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <section className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-xl font-semibold text-balance">Scan Tickets</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Decisions are authoritative while this device is online. Check-in
            Window: {checkInWindow}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={eventStatus === "canceled" ? "destructive" : "secondary"}
          >
            {eventStatus === "canceled" ? "Event canceled" : "Online"}
          </Badge>
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
          aria-label="Scan Attempt synchronization"
          className="flex flex-wrap items-center justify-between gap-3 border-b pb-6"
        >
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {pendingAttemptCount > 0
              ? `${pendingAttemptCount} pending Scan Attempt${pendingAttemptCount === 1 ? "" : "s"} stored on this device.`
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
        <div className="flex flex-col gap-3">
          <Alert
            ref={resultRef}
            tabIndex={-1}
            variant={presentation.destructive ? "destructive" : "default"}
            className={cn(
              "min-h-32 items-start p-5",
              !presentation.destructive && "border-foreground",
            )}
            aria-live="assertive"
          >
            <ResultIcon aria-hidden="true" className="mt-0.5 size-7" />
            <AlertTitle className="text-lg">{presentation.title}</AlertTitle>
            <AlertDescription className="mt-1 text-base">
              {result.attendeeName ? (
                <strong className="text-foreground">
                  {result.attendeeName}.{" "}
                </strong>
              ) : null}
              {presentation.description}
            </AlertDescription>
          </Alert>
          {result.outcome === "accepted" && result.checkInId ? (
            <ReasonedCheckInAction
              label={
                actorRole === "check_in_volunteer"
                  ? "Quick Reversal"
                  : "Reverse Check-in"
              }
              title="Make this Ticket admissible again?"
              description="This invalidates the active Check-in without deleting the Check-in or Scan Attempt. The Ticket can then be admitted again."
              reasonDescription="The correction and reason are retained in the immutable Audit Entry."
              variant="destructive"
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
                setSyncMessage("Check-in reversed. The Ticket is admissible again.");
              }}
            />
          ) : null}
          {(result.outcome === "outside_window" ||
            result.outcome === "expired") &&
          actorRole !== "check_in_volunteer" &&
          lastInput ? (
            <ReasonedCheckInAction
              label="Admit with override"
              title="Admit outside the Check-in Window?"
              description="This creates an authoritative Check-in outside the configured window. Use it only for an accountable operational exception."
              reasonDescription="Only Organizers can override the window. The reason is retained in the immutable Audit Entry."
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
                        "The override was not accepted. Confirm your Organizer access and connectivity.",
                    };
              }}
            />
          ) : null}
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
            Point the rear camera at the Ticket QR representation.
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
            {result ? "Scan next Ticket" : "Start camera"}
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
            Enter Ticket Code
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Always available when a camera is unsupported, unavailable, or
            inconvenient.
          </p>
        </div>
        <form onSubmit={handleManualSubmit} noValidate>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="ticket-code">Ticket Code</FieldLabel>
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
                className="min-h-11 font-mono tracking-wider"
              />
              <FieldDescription>
                Ten Crockford Base32 characters. The separator is optional.
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
              {isPending ? "Checking Ticket…" : "Check Ticket"}
            </Button>
          </FieldGroup>
        </form>
      </section>
    </div>
  );
}
