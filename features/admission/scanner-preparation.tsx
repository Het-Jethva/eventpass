"use client";

import { useEffect, useState } from "react";
import {
  IconCloudCheck,
  IconCloudOff,
  IconDatabase,
  IconDeviceMobile,
  IconRefresh,
  IconShieldCheck,
} from "@tabler/icons-react";

import { prepareOfflineScannerAction } from "@/app/scanner/[eventId]/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  getSnapshotReadiness,
  type OfflineEventSnapshot,
} from "./offline-snapshot";
import {
  offlineScannerStore,
  SnapshotReplacementRequiredError,
} from "./offline-snapshot-store";

type ReplacementRequest = {
  snapshot: OfflineEventSnapshot;
  currentEventName: string;
  pendingAttemptCount: number;
};

function formatSnapshotAge(generatedAt: string, now: Date) {
  const elapsedSeconds = Math.max(
    0,
    Math.floor((now.getTime() - new Date(generatedAt).getTime()) / 1000),
  );
  if (elapsedSeconds < 60) return "less than a minute old";
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} old`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"} old`;
}

function formatEventTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

export function ScannerPreparation({ eventId }: { eventId: string }) {
  const [deviceId, setDeviceId] = useState("");
  const [deviceLabel, setDeviceLabel] = useState("");
  const [snapshot, setSnapshot] = useState<OfflineEventSnapshot | null>(null);
  const [online, setOnline] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replacement, setReplacement] =
    useState<ReplacementRequest | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      offlineScannerStore.getOrCreateScannerDevice(),
      offlineScannerStore.getCachedSnapshot(),
    ])
      .then(([device, cachedSnapshot]) => {
        if (!active) return;
        setDeviceId(device.id);
        setDeviceLabel(device.label);
        setSnapshot(cachedSnapshot);
      })
      .catch(() => {
        if (active) {
          setError(
            "This browser could not open its offline storage. Check browser storage permissions and try again.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function updateConnectivity() {
      setOnline(navigator.onLine);
    }
    updateConnectivity();
    window.addEventListener("online", updateConnectivity);
    window.addEventListener("offline", updateConnectivity);
    return () => {
      window.removeEventListener("online", updateConnectivity);
      window.removeEventListener("offline", updateConnectivity);
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  async function persistPreparedSnapshot(
    preparedSnapshot: OfflineEventSnapshot,
    replaceExisting = false,
  ) {
    await offlineScannerStore.cacheSnapshot(preparedSnapshot, {
      replaceExisting,
    });
    await offlineScannerStore.updateScannerDeviceLabel(deviceLabel.trim());
    setSnapshot(preparedSnapshot);
    setReplacement(null);
  }

  async function prepare() {
    if (!deviceId || deviceLabel.trim().length < 2 || pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await prepareOfflineScannerAction({
        eventId,
        scannerDeviceId: deviceId,
        scannerDeviceLabel: deviceLabel.trim(),
      });
      if (result.outcome === "unauthorized") {
        setError(
          "Current Check-in volunteer access is required to prepare this event for offline admission.",
        );
        return;
      }
      if (result.outcome === "event_unavailable") {
        setError("This Event is not available for offline preparation.");
        return;
      }
      try {
        await persistPreparedSnapshot(result.snapshot);
      } catch (cacheError) {
        if (cacheError instanceof SnapshotReplacementRequiredError) {
          setReplacement({
            snapshot: result.snapshot,
            currentEventName: cacheError.currentEventName,
            pendingAttemptCount: cacheError.pendingAttemptCount,
          });
          return;
        }
        throw cacheError;
      }
    } catch {
      setError(
        "The Offline Event Snapshot could not be prepared. Confirm this device is online, then try again.",
      );
    } finally {
      setPending(false);
    }
  }

  async function confirmReplacement() {
    if (!replacement) return;
    setPending(true);
    setError(null);
    try {
      await persistPreparedSnapshot(replacement.snapshot, true);
    } catch {
      setError("The cached event could not be replaced. Try again.");
    } finally {
      setPending(false);
    }
  }

  const currentSnapshot = snapshot?.event.id === eventId ? snapshot : null;
  const readiness = currentSnapshot
    ? getSnapshotReadiness(currentSnapshot, now)
    : null;

  return (
    <section aria-labelledby="offline-preparation-heading" className="border-b pb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="offline-preparation-heading" className="font-medium">
            Offline preparation
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Name this browser, issue its Scanner Authorization, and cache the
            minimum ticket data needed for offline admission.
          </p>
        </div>
        <Badge variant={online ? "secondary" : "destructive"}>
          {online ? <IconCloudCheck data-icon="inline-start" /> : <IconCloudOff data-icon="inline-start" />}
          {online ? "Online" : "Offline"}
        </Badge>
      </div>

      <div className="mt-5 flex flex-col gap-5">
        {currentSnapshot ? (
          <Alert
            variant={readiness === "ready" ? "default" : "destructive"}
            aria-live="polite"
          >
            {readiness === "ready" ? <IconShieldCheck /> : <IconRefresh />}
            <AlertTitle>
              {readiness === "ready"
                ? "Offline Event Snapshot ready"
                : readiness === "refresh_required"
                  ? "Snapshot refresh required"
                  : "Scanner Authorization expired"}
            </AlertTitle>
            <AlertDescription>
              Snapshot {formatSnapshotAge(currentSnapshot.generatedAt, now)} ·{" "}
              {currentSnapshot.tickets.length} Ticket
              {currentSnapshot.tickets.length === 1 ? "" : "s"} · Authorization
              expires {formatEventTime(
                currentSnapshot.event.checkInClosesAt,
                currentSnapshot.event.eventTimeZone,
              )}.
            </AlertDescription>
          </Alert>
        ) : snapshot ? (
          <Alert>
            <IconDatabase />
            <AlertTitle>{snapshot.event.name} is cached</AlertTitle>
            <AlertDescription>
              Preparing this event requires confirmation before replacing the
              browser&apos;s current Offline Event Snapshot.
            </AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <Alert variant="destructive" aria-live="assertive">
            <IconCloudOff />
            <AlertTitle>Offline preparation unavailable</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="scanner-device-label">
              Scanner Device label
            </FieldLabel>
            <Input
              id="scanner-device-label"
              value={deviceLabel}
              onChange={(event) => setDeviceLabel(event.target.value)}
              placeholder="Main entrance phone"
              autoComplete="off"
              maxLength={80}
              disabled={!deviceId || pending}
            />
            <FieldDescription>
              Use a label volunteers can recognize. EventPass uses a random
              browser UUID, never device fingerprinting.
            </FieldDescription>
          </Field>
          {deviceId ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <IconDeviceMobile aria-hidden="true" className="size-4" />
              <span className="font-mono">{deviceId}</span>
            </p>
          ) : null}
          <Button
            type="button"
            variant={currentSnapshot ? "outline" : "default"}
            className="min-h-11 sm:self-start"
            disabled={
              !online || !deviceId || deviceLabel.trim().length < 2 || pending
            }
            onClick={() => void prepare()}
          >
            {pending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <IconDatabase data-icon="inline-start" />
            )}
            {pending
              ? "Preparing…"
              : currentSnapshot
                ? "Refresh snapshot"
                : "Prepare for offline"}
          </Button>
        </FieldGroup>
      </div>

      <AlertDialog
        open={Boolean(replacement)}
        onOpenChange={(open) => {
          if (!open && !pending) setReplacement(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace the cached event?</AlertDialogTitle>
            <AlertDialogDescription>
              This browser currently has {replacement?.currentEventName} cached.
              Its Offline Event Snapshot will be replaced. {replacement?.pendingAttemptCount ?? 0} unsynchronized scan Attempt
              {(replacement?.pendingAttemptCount ?? 0) === 1 ? "" : "s"} will be preserved for later synchronization.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep current event</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={() => void confirmReplacement()}
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Replace snapshot
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
