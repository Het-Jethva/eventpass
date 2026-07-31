"use client";

import { useEffect, useState } from "react";
import { IconDownload, IconInfoCircle, IconRefresh } from "@tabler/icons-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { offlineScannerStore } from "./offline-snapshot-store";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaUpdateManager() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [updateWaiting, setUpdateWaiting] = useState<ServiceWorker | null>(null);
  const [pendingAttempts, setPendingAttempts] = useState(0);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  const [isStandalone] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    );
  });

  const [isIOS] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Register service worker and handle updates
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          if (registration.waiting) {
            setUpdateWaiting(registration.waiting);
          }

          registration.addEventListener("updatefound", () => {
            const installingWorker = registration.installing;
            if (!installingWorker) return;
            installingWorker.addEventListener("statechange", () => {
              if (
                installingWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                setUpdateWaiting(installingWorker);
              }
            });
          });
        })
        .catch(() => {
          // Service worker registration error handled silently
        });

      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }

    // Capture install prompt
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  // Check pending attempt count periodically or when update waiting is set
  useEffect(() => {
    let active = true;
    async function checkPending() {
      try {
        const count = await offlineScannerStore.countAllPendingScanAttempts();
        if (active) setPendingAttempts(count);
      } catch {
        // Dexie access error handled safely
      }
    }
    void checkPending();
    const interval = window.setInterval(() => void checkPending(), 5_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  // Apply deferred update if 0 pending attempts remain
  useEffect(() => {
    if (updateWaiting && pendingAttempts === 0) {
      updateWaiting.postMessage({ type: "SKIP_WAITING" });
    }
  }, [updateWaiting, pendingAttempts]);

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  }

  function handleApplyUpdateNow() {
    if (updateWaiting && pendingAttempts === 0) {
      updateWaiting.postMessage({ type: "SKIP_WAITING" });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {updateWaiting ? (
        <Alert variant={pendingAttempts > 0 ? "default" : "default"}>
          <IconRefresh className="size-5 animate-spin text-foreground" />
          <AlertTitle>
            {pendingAttempts > 0
              ? "Application update deferred"
              : "New version available"}
          </AlertTitle>
          <AlertDescription className="mt-1 text-sm flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {pendingAttempts > 0
                ? `${pendingAttempts} unsynchronized scan Attempt${pendingAttempts === 1 ? "" : "s"} stored on this device. Update will apply after synchronization.`
                : "An update is ready for installation."}
            </span>
            {pendingAttempts === 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleApplyUpdateNow}
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
            <span>Install EventPass as a PWA for fast offline ticket scanning.</span>
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

      {!isStandalone && !deferredPrompt && isIOS && showIOSPrompt ? (
        <Alert>
          <IconInfoCircle className="size-5 text-foreground" />
          <AlertTitle>Install on iOS</AlertTitle>
          <AlertDescription className="mt-1 text-sm flex flex-col gap-2">
            <span>
              To install EventPass on iPhone: Tap the Share button in Safari, then select <strong>Add to Home Screen</strong>.
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="self-start text-xs text-muted-foreground"
              onClick={() => setShowIOSPrompt(false)}
            >
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
