"use client";

import { useEffect, useState } from "react";
import { IconDownload, IconRefresh } from "@tabler/icons-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { offlineScannerStore } from "./offline-snapshot-store";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isBeforeInstallPromptEvent(
  event: Event,
): event is BeforeInstallPromptEvent {
  return (
    "prompt" in event &&
    typeof event.prompt === "function" &&
    "userChoice" in event
  );
}

export function PwaUpdateManager() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [updateWaiting, setUpdateWaiting] = useState<ServiceWorker | null>(
    null,
  );
  const [pendingAttempts, setPendingAttempts] = useState<number | null>(null);

  const [isStandalone] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && navigator.standalone === true)
    );
  });

  useEffect(() => {
    let active = true;
    let registration: ServiceWorkerRegistration | null = null;
    let installingWorker: ServiceWorker | null = null;
    let refreshing = false;
    const handleControllerChange = () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    };
    const handleWorkerStateChange = () => {
      if (
        installingWorker?.state === "installed" &&
        navigator.serviceWorker.controller
      ) {
        setUpdateWaiting(installingWorker);
      }
    };
    const handleUpdateFound = () => {
      installingWorker?.removeEventListener(
        "statechange",
        handleWorkerStateChange,
      );
      installingWorker = registration?.installing ?? null;
      installingWorker?.addEventListener(
        "statechange",
        handleWorkerStateChange,
      );
    };

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registered) => {
          if (!active) return;
          registration = registered;
          if (registered.waiting) setUpdateWaiting(registered.waiting);
          registered.addEventListener("updatefound", handleUpdateFound);
          handleUpdateFound();
        })
        .catch(() => {
          // Service worker registration error handled silently
        });

      navigator.serviceWorker.addEventListener(
        "controllerchange",
        handleControllerChange,
      );
    }

    // Capture install prompt
    const handleBeforeInstallPrompt = (event: Event) => {
      if (!isBeforeInstallPromptEvent(event)) return;
      event.preventDefault();
      setDeferredPrompt(event);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      active = false;
      registration?.removeEventListener("updatefound", handleUpdateFound);
      installingWorker?.removeEventListener(
        "statechange",
        handleWorkerStateChange,
      );
      navigator.serviceWorker?.removeEventListener(
        "controllerchange",
        handleControllerChange,
      );
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function checkPending() {
      try {
        const count = await offlineScannerStore.countAllPendingScanAttempts();
        if (active) {
          setPendingAttempts(count);
          if (updateWaiting && count === 0) {
            updateWaiting.postMessage({ type: "SKIP_WAITING" });
          }
        }
      } catch {
        if (active) setPendingAttempts(null);
      }
    }
    void checkPending();
    const interval = window.setInterval(() => void checkPending(), 5_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [updateWaiting]);

  const updateBlocked = pendingAttempts === null || pendingAttempts > 0;

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  }

  async function handleApplyUpdateNow() {
    if (!updateWaiting) return;
    try {
      const count = await offlineScannerStore.countAllPendingScanAttempts();
      setPendingAttempts(count);
      if (count === 0) updateWaiting.postMessage({ type: "SKIP_WAITING" });
    } catch {
      setPendingAttempts(null);
    }
  }

  if (!updateWaiting && (isStandalone || !deferredPrompt)) return null;

  return (
    <div className="flex flex-col gap-3">
      {updateWaiting ? (
        <Alert>
          <IconRefresh className="size-5 animate-spin text-foreground" />
          <AlertTitle>
            {updateBlocked
              ? "Application update deferred"
              : "New version available"}
          </AlertTitle>
          <AlertDescription className="mt-1 text-sm flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {pendingAttempts === null
                ? "Checking this device for unsynced scans. Updates wait until the queue is confirmed empty."
                : updateBlocked
                  ? `${pendingAttempts} scan${pendingAttempts === 1 ? "" : "s"} on this device have not synced yet. The update applies once they do.`
                  : "An update is ready for installation."}
            </span>
            {!updateBlocked ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void handleApplyUpdateNow()}
              >
                Reload to update
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {!isStandalone && deferredPrompt ? (
        <Alert>
          <IconDownload className="size-5 text-foreground" />
          <AlertTitle>Install EventPass</AlertTitle>
          <AlertDescription className="mt-1 text-sm flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Install EventPass as a PWA for fast offline ticket scanning.
            </span>
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={() => void handleInstallClick()}
            >
              Install App
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
