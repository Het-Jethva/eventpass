/**
 * Resolves the five orthogonal state sources behind a Registration into one
 * authoritative status plus, when it matters, a single qualifying fact.
 *
 * A roster row's real state is spread across `registration.status`, whether an
 * unconfirmed Registration's Capacity Hold is still live, `admission_offer`,
 * `ticket.status`, and whether a Check-in is active or was invalidated. Showing
 * five columns makes the Organizer synthesize them; showing one badge discards
 * facts that matter at the gate — a confirmed Attendee whose Ticket was
 * replaced is not the same as one whose Ticket is fine.
 *
 * So: one resolved status by documented precedence, plus at most one qualifier.
 * Kept pure and free of React or Drizzle so the precedence is testable without
 * a database, which is the only reason it is a separate module.
 */

export type RegistrationStatus =
  | "unconfirmed"
  | "confirmed"
  | "waitlisted"
  | "expired"
  | "canceled";

export type TicketStatus = "active" | "replaced" | "canceled";

export type AdmissionOfferStatus = "active" | "claimed" | "expired";

export type RosterStatusKey =
  | "canceled"
  | "checked_in"
  | "confirmed"
  | "offer_sent"
  | "waitlisted"
  | "unconfirmed"
  | "expired";

/**
 * Badge emphasis rather than a colour. DESIGN.md reserves `destructive` for
 * errors, invalid Tickets, cancellation and suspension, and forbids inventing
 * per-component palettes, so these map onto existing Badge variants only. Every
 * status also carries a distinct label and icon, so none of them rely on colour.
 */
export type RosterStatusEmphasis = "primary" | "muted" | "outline" | "destructive";

export type RosterStatusDeadline = {
  kind: "capacity_hold" | "admission_offer";
  at: Date;
};

export type RosterStatus = {
  key: RosterStatusKey;
  label: string;
  emphasis: RosterStatusEmphasis;
  /** The single most decision-relevant secondary fact, already human-readable. */
  qualifier: string | null;
  /** A deadline still running. The caller formats it in the Event Time Zone. */
  deadline: RosterStatusDeadline | null;
};

export type RosterStatusInput = {
  registrationStatus: RegistrationStatus;
  /** Latest Ticket for the Registration, or null when none was ever issued. */
  ticketStatus: TicketStatus | null;
  /** True when the latest Ticket has a Check-in that has not been invalidated. */
  hasActiveCheckIn: boolean;
  /** True when a Check-in existed and was reversed. Preserved admission history. */
  hasReversedCheckIn: boolean;
  capacityHold: { expiresAt: Date; claimedAt: Date | null } | null;
  admissionOffer: { status: AdmissionOfferStatus; expiresAt: Date } | null;
};

function ticketQualifier(input: RosterStatusInput): string | null {
  if (input.ticketStatus === "canceled") return "Ticket canceled";
  if (input.ticketStatus === "replaced") return "Ticket replaced";
  if (input.ticketStatus === null) return "No Ticket issued";
  return null;
}

/**
 * Precedence, highest first:
 *
 * 1. Canceled — terminal and overrides everything below it.
 * 2. Checked in — the Attendee is physically through the gate; nothing about
 *    Ticket bookkeeping changes that, so it outranks Ticket state.
 * 3. Confirmed.
 * 4. Admission Offer sent — a live Offer is more actionable than the Waitlist
 *    Entry behind it, and CONTEXT.md is explicit that an Offer is not a Ticket.
 * 5. Waitlisted.
 * 6. Unconfirmed — a live Capacity Hold is a qualifier here, not its own state,
 *    because the Registration is unconfirmed either way.
 * 7. Expired — terminal, and last because any other status is more informative.
 */
export function resolveRosterStatus(
  input: RosterStatusInput,
  now: Date,
): RosterStatus {
  if (input.registrationStatus === "canceled") {
    return {
      key: "canceled",
      label: "Canceled",
      emphasis: "destructive",
      qualifier: input.hasActiveCheckIn ? "Checked in before cancellation" : null,
      deadline: null,
    };
  }

  if (input.registrationStatus === "expired") {
    const offerLapsed = input.admissionOffer?.status === "expired";
    return {
      key: "expired",
      label: "Expired",
      emphasis: "outline",
      qualifier: offerLapsed
        ? "Admission Offer not claimed"
        : "Capacity Hold not claimed",
      deadline: null,
    };
  }

  if (input.registrationStatus === "confirmed") {
    if (input.hasActiveCheckIn) {
      return {
        key: "checked_in",
        label: "Checked in",
        emphasis: "primary",
        // A replaced or canceled Ticket behind an active Check-in is worth
        // surfacing even though admission already happened.
        qualifier: ticketQualifier(input),
        deadline: null,
      };
    }

    return {
      key: "confirmed",
      label: "Confirmed",
      emphasis: "muted",
      qualifier: ticketQualifier(input) ?? (input.hasReversedCheckIn ? "Check-in reversed" : null),
      deadline: null,
    };
  }

  if (input.registrationStatus === "waitlisted") {
    const offer = input.admissionOffer;

    if (offer && offer.status === "active" && offer.expiresAt > now) {
      return {
        key: "offer_sent",
        label: "Admission Offer sent",
        emphasis: "outline",
        qualifier: null,
        deadline: { kind: "admission_offer", at: offer.expiresAt },
      };
    }

    return {
      key: "waitlisted",
      label: "Waitlisted",
      emphasis: "muted",
      qualifier:
        offer && (offer.status === "expired" || offer.expiresAt <= now)
          ? "Admission Offer expired"
          : null,
      deadline: null,
    };
  }

  const hold = input.capacityHold;
  const holdIsLive = Boolean(hold && !hold.claimedAt && hold.expiresAt > now);

  return {
    key: "unconfirmed",
    label: "Unconfirmed",
    emphasis: "outline",
    qualifier: holdIsLive ? null : "Capacity Hold expired",
    deadline: holdIsLive && hold ? { kind: "capacity_hold", at: hold.expiresAt } : null,
  };
}
