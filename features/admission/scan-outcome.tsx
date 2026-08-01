import type { ReactNode } from "react";
import {
  IconAlertTriangle,
  IconCalendarCancel,
  IconCircleCheck,
  IconClockExclamation,
  IconClockX,
  IconCloudUpload,
  IconCopyCheck,
  IconHelpHexagon,
  IconLock,
  IconRefresh,
  type Icon,
} from "@tabler/icons-react";

import type { AdmissionOutcome } from "@/features/admission/server/admission-application";
import { cn } from "@/lib/utils";

// The signature interaction. A volunteer reads this at arm's length, in a lit
// gym, with a queue behind them — so it takes over the screen rather than
// arriving as a notification, and it never animates in.
//
// Kept separate from ScannerWorkspace so the landing page can render the real
// component with static props instead of a screenshot that goes stale.

// Four answers a volunteer actually acts on, rather than the destructive
// boolean this replaced — which rendered "Checked in" and "Checked in
// (provisional)" identically, and made "already checked in" look like a
// malformed signature.
export type ScanTone = "success" | "provisional" | "warning" | "destructive";

const TONE_STYLES: Record<
  ScanTone,
  { surface: string; text: string; chip: string }
> = {
  // Signal tokens are pinned across themes on purpose: ambient venue light
  // beats theme preference at a door.
  success: {
    surface: "bg-signal-success",
    text: "text-signal-success-text",
    chip: "bg-signal-success-text/10 text-signal-success-text",
  },
  provisional: {
    surface: "bg-signal-provisional",
    text: "text-signal-provisional-text",
    chip: "bg-signal-provisional-text/10 text-signal-provisional-text",
  },
  warning: {
    surface: "bg-signal-warning",
    text: "text-signal-warning-text",
    chip: "bg-signal-warning-text/10 text-signal-warning-text",
  },
  destructive: {
    surface: "bg-signal-destructive",
    text: "text-signal-destructive-text",
    chip: "bg-signal-destructive-text/10 text-signal-destructive-text",
  },
};

type Presentation = {
  title: string;
  description: string;
  icon: Icon;
  tone: ScanTone;
  /** Shown as a chip above the headline when the outcome carries a caveat. */
  qualifier?: string;
};

// Written to be read in one glance by someone with a queue in front of them.
// Every line says what happened and, where there is one, what to do next —
// never how the system arrived at the answer.
export const outcomePresentation: Record<AdmissionOutcome, Presentation> = {
  accepted: {
    title: "Checked in",
    description: "Let them through. This ticket will not scan again.",
    icon: IconCircleCheck,
    tone: "success",
  },
  provisional: {
    title: "Checked in",
    description:
      "Let them through. Saved on this phone; reconnect to reconcile it with other scanners. Any conflict stays visible.",
    icon: IconCloudUpload,
    tone: "provisional",
    // The product's whole thesis in three words. It previously rendered in the
    // same colour as a confirmed acceptance.
    qualifier: "Offline · not confirmed yet",
  },
  duplicate: {
    title: "Already checked in",
    description:
      "This ticket was used earlier. Check with the guest before letting them through.",
    icon: IconCopyCheck,
    tone: "warning",
  },
  invalid: {
    title: "Invalid ticket",
    description:
      "This code was not issued by EventPass. Ask the guest to open their ticket email.",
    icon: IconAlertTriangle,
    tone: "destructive",
  },
  unknown: {
    title: "Ticket not found",
    description:
      "No ticket for this event matches that code. They may be at the wrong door.",
    icon: IconHelpHexagon,
    tone: "destructive",
  },
  canceled: {
    title: "Ticket canceled",
    description: "This ticket was canceled and cannot be used for entry.",
    icon: IconCalendarCancel,
    tone: "destructive",
  },
  replaced: {
    title: "Ticket replaced",
    description:
      "A newer ticket was sent to this guest. Ask them to open their most recent email.",
    icon: IconRefresh,
    tone: "warning",
    qualifier: "Ask for the newer ticket",
  },
  expired: {
    title: "Check-in closed",
    description: "Check-in for this event has ended.",
    icon: IconClockX,
    tone: "destructive",
  },
  outside_window: {
    title: "Check-in not open",
    description:
      "The ticket is fine — check-in has not started yet. Ask them to come back shortly.",
    icon: IconClockExclamation,
    tone: "warning",
    qualifier: "Valid ticket, too early",
  },
  unauthorized: {
    title: "No scanner access",
    description:
      "Your account cannot admit guests for this event. Ask an organizer to add you.",
    icon: IconLock,
    tone: "destructive",
  },
  event_unavailable: {
    title: "Event currently unavailable",
    description:
      "Admission is temporarily unavailable for this Event. Keep any pending offline attempts and try again later.",
    icon: IconLock,
    tone: "warning",
  },
};

export function ScanOutcome({
  outcome,
  attendeeName,
  ticketCode,
  actions,
  className,
  reserveQualifier = false,
  titleAs: Title = "h2",
}: {
  outcome: AdmissionOutcome;
  attendeeName?: string | null;
  ticketCode?: string | null;
  /** Exactly one next action belongs here. */
  actions?: ReactNode;
  className?: string;
  /**
   * Hold the qualifier chip's space when this outcome has no qualifier.
   *
   * At a door there is one outcome on the screen and nothing to align it to, so
   * this stays off and the content centres as a block. Side by side — which is
   * how the landing page argues that a confirmed yes and an offline yes are
   * different — one card carrying a chip pushed its icon, headline and name
   * out of register with the other's, and the pair read as sloppy at exactly
   * the moment it was claiming precision.
   */
  reserveQualifier?: boolean;
  /**
   * A live outcome is a heading the screen reader announces. A demonstration of
   * one on the landing page is not part of that page's outline, so the showcase
   * passes `p` rather than putting "Checked in" in the document's heading tree.
   */
  titleAs?: "h2" | "h3" | "p";
}) {
  const presentation = outcomePresentation[outcome];
  const tone = TONE_STYLES[presentation.tone];
  const OutcomeIcon = presentation.icon;

  return (
    <div
      data-slot="scan-outcome"
      data-outcome={outcome}
      className={cn(
        // `signal-surface` pins the neutral tokens for this subtree. The
        // outcome surface is deliberately light in both themes, so any control
        // rendered into `actions` has to be light too — otherwise dark mode
        // drops a near-black button onto a mint background.
        "signal-surface flex h-full w-full flex-col items-center justify-center gap-5 px-6 py-10 text-center",
        tone.surface,
        tone.text,
        className,
      )}
    >
      <OutcomeIcon aria-hidden="true" className="size-24 shrink-0" />

      {presentation.qualifier ? (
        <span
          className={cn(
            "rounded-full px-3 py-1 text-sm font-medium",
            tone.chip,
          )}
        >
          {presentation.qualifier}
        </span>
      ) : reserveQualifier ? (
        <span aria-hidden="true" className="px-3 py-1 text-sm font-medium">
          &nbsp;
        </span>
      ) : null}

      {/* Weight, not size alone, carries this across a lit room. */}
      <Title className="text-4xl font-semibold text-balance sm:text-5xl">
        {presentation.title}
      </Title>

      {attendeeName ? (
        <p className="text-2xl font-medium text-balance sm:text-3xl">
          {attendeeName}
        </p>
      ) : null}

      {ticketCode ? (
        <p className="font-mono text-lg tracking-code opacity-80">
          {ticketCode}
        </p>
      ) : null}

      <p className="max-w-md text-base text-pretty opacity-90 sm:text-lg">
        {presentation.description}
      </p>

      {actions ? (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
