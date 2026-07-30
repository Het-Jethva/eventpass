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
// arriving as a notification, and it never animates in. See DESIGN.md.
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

export const outcomePresentation: Record<AdmissionOutcome, Presentation> = {
  accepted: {
    title: "Checked in",
    description:
      "Admission recorded. The Ticket cannot be used again while this Check-in is active.",
    icon: IconCircleCheck,
    tone: "success",
  },
  provisional: {
    title: "Checked in",
    description:
      "Stored on this device. Synchronization will establish the authoritative Check-in when connectivity returns.",
    icon: IconCloudUpload,
    tone: "provisional",
    // The product's whole thesis in two words. It previously rendered in the
    // same colour as a confirmed acceptance.
    qualifier: "Offline · provisional",
  },
  duplicate: {
    title: "Already checked in",
    description:
      "This Ticket already has an active Check-in. This attempt was recorded as a duplicate.",
    icon: IconCopyCheck,
    tone: "warning",
  },
  invalid: {
    title: "Invalid Ticket",
    description:
      "The QR representation or Ticket Code is malformed or its signature is not valid.",
    icon: IconAlertTriangle,
    tone: "destructive",
  },
  unknown: {
    title: "Ticket not found",
    description:
      "No Ticket for this Event matches that QR representation or Ticket Code.",
    icon: IconHelpHexagon,
    tone: "destructive",
  },
  canceled: {
    title: "Ticket canceled",
    description: "This Ticket or Event was canceled and cannot be admitted.",
    icon: IconCalendarCancel,
    tone: "destructive",
  },
  replaced: {
    title: "Ticket replaced",
    description:
      "A newer Ticket was issued for this Registration. Ask the Attendee for the replacement.",
    icon: IconRefresh,
    tone: "warning",
    qualifier: "Ask for the newer Ticket",
  },
  expired: {
    title: "Check-in closed",
    description:
      "The Check-in Window has ended, so this Ticket is no longer admissible.",
    icon: IconClockX,
    tone: "destructive",
  },
  outside_window: {
    title: "Check-in not open",
    description:
      "This Ticket is valid, but the Check-in Window has not opened yet.",
    icon: IconClockExclamation,
    tone: "warning",
    qualifier: "Valid Ticket, too early",
  },
  unauthorized: {
    title: "Scanner access unavailable",
    description:
      "Your current staff access does not authorize admission for this Event.",
    icon: IconLock,
    tone: "destructive",
  },
};

export function ScanOutcome({
  outcome,
  attendeeName,
  ticketCode,
  actions,
  className,
}: {
  outcome: AdmissionOutcome;
  attendeeName?: string | null;
  ticketCode?: string | null;
  /** Exactly one next action belongs here. */
  actions?: ReactNode;
  className?: string;
}) {
  const presentation = outcomePresentation[outcome];
  const tone = TONE_STYLES[presentation.tone];
  const OutcomeIcon = presentation.icon;

  return (
    <div
      data-slot="scan-outcome"
      data-outcome={outcome}
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-5 px-6 py-10 text-center",
        tone.surface,
        tone.text,
        className,
      )}
    >
      <OutcomeIcon aria-hidden="true" className="size-24 shrink-0" />

      {presentation.qualifier ? (
        <span
          className={cn(
            "rounded-full px-3 py-1 text-sm font-semibold tracking-wide uppercase",
            tone.chip,
          )}
        >
          {presentation.qualifier}
        </span>
      ) : null}

      {/* Sans, never the display serif: arm's-length legibility is a safety
          property, not a styling choice. */}
      <h2 className="text-4xl leading-tight font-semibold text-balance sm:text-5xl">
        {presentation.title}
      </h2>

      {attendeeName ? (
        <p className="text-2xl font-medium text-balance sm:text-3xl">
          {attendeeName}
        </p>
      ) : null}

      {ticketCode ? (
        <p className="font-mono text-lg tracking-[0.12em] opacity-80">
          {ticketCode}
        </p>
      ) : null}

      <p className="max-w-md text-base leading-relaxed text-pretty opacity-90 sm:text-lg">
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
