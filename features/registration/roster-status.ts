import { parseEnum } from "@/lib/parse-enum";

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

// Drizzle types these `text` columns as `string`. The database check
// constraints are the enums, so each read parses back into that list.
export const registrationStatuses = [
  "unconfirmed",
  "confirmed",
  "waitlisted",
  "expired",
  "canceled",
] as const;

export type RegistrationStatus = (typeof registrationStatuses)[number];

export const ticketStatuses = ["active", "replaced", "canceled"] as const;

export type TicketStatus = (typeof ticketStatuses)[number];

export const admissionOfferStatuses = ["active", "claimed", "expired"] as const;

export type AdmissionOfferStatus = (typeof admissionOfferStatuses)[number];

export const registrationSources = ["attendee", "imported"] as const;

export type RegistrationSource = (typeof registrationSources)[number];

export function parseRegistrationStatus(value: string): RegistrationStatus {
  return parseEnum(value, registrationStatuses, "registration status");
}

export function parseTicketStatus(value: string): TicketStatus {
  return parseEnum(value, ticketStatuses, "ticket status");
}

export function parseAdmissionOfferStatus(value: string): AdmissionOfferStatus {
  return parseEnum(value, admissionOfferStatuses, "admission offer status");
}

export function parseRegistrationSource(value: string): RegistrationSource {
  return parseEnum(value, registrationSources, "registration source");
}

export type RosterStatusKey =
  | "canceled"
  | "checked_in"
  | "confirmed"
  | "offer_sent"
  | "waitlisted"
  | "unconfirmed"
  | "expired";

/**
 * Badge emphasis rather than a colour. `destructive` is reserved for errors,
 * invalid Tickets, cancellation and suspension, and per-component palettes are
 * forbidden, so these map onto existing Badge variants only. Every
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
 * Precedence of the registration status, then the facts that refine it.
 *
 * 1. Canceled. A prior check-in is only a qualifier.
 * 2. Expired. That registration never became a ticket, so it outranks a
 *    check-in recorded against it.
 * 3. Confirmed. An active check-in becomes Checked in and outranks ticket
 *    bookkeeping, which stays as the qualifier.
 * 4. Waitlisted. A live Admission Offer becomes Admission Offer sent.
 * 5. Unconfirmed. A live Capacity Hold is a deadline, not its own status.
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
    const holdLapsed = input.capacityHold !== null && !offerLapsed;
    return {
      key: "expired",
      label: "Expired",
      emphasis: "outline",
      qualifier: offerLapsed
        ? "Admission Offer not claimed"
        : holdLapsed
          ? "Capacity Hold not claimed"
          : null,
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
  const holdLapsed = Boolean(hold && !hold.claimedAt && hold.expiresAt <= now);

  return {
    key: "unconfirmed",
    label: "Unconfirmed",
    emphasis: "outline",
    qualifier: holdLapsed ? "Capacity Hold expired" : null,
    deadline: holdIsLive && hold ? { kind: "capacity_hold", at: hold.expiresAt } : null,
  };
}
