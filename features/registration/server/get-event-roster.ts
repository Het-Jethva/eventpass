import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";

import type { db as database } from "@/lib/db";
import {
  admissionOffer,
  capacityHold,
  checkIn,
  event,
  eventStaff,
  registration,
  registrationAnswer,
  registrationField,
  ticket,
} from "@/lib/db/schema";
import type { RosterFilter } from "@/features/registration/roster-filters";
import {
  resolveRosterStatus,
  type AdmissionOfferStatus,
  type RegistrationStatus,
  type RosterStatus,
  type TicketStatus,
} from "@/features/registration/roster-status";

/**
 * The Organizer's attendee roster.
 *
 * Read-only by design. Every per-Registration mutation — resend, replace,
 * cancel, edit answers — is scoped by CONTEXT.md to the Attendee's own
 * Registration Management Link, so this deliberately adds no organizer-side
 * equivalents.
 *
 * Search, filter and paging resolve in Postgres rather than in the browser. The
 * query that matters most at a check-in desk is "find the person standing in
 * front of me", and a client-side filter over a truncated window is exactly the
 * one that fails it.
 */

export const ROSTER_PAGE_SIZE = 25;

export type RosterAnswer = {
  fieldId: string;
  label: string;
  archived: boolean;
  value: string;
};

export type RosterRow = {
  registrationId: string;
  attendeeName: string;
  email: string;
  source: "attendee" | "imported";
  registeredAt: Date;
  status: RosterStatus;
  ticketCode: string | null;
  checkedInAt: Date | null;
  answers: RosterAnswer[];
};

export type RosterCursor = { registeredAt: Date; registrationId: string };

export type EventRoster = {
  rows: RosterRow[];
  /** Cursor for the next page, or null when this is the last one. */
  nextCursor: RosterCursor | null;
  /** Rows matching the current search and filter, across all pages. */
  matchingCount: number;
  /** Rows in the Event regardless of search and filter. */
  totalCount: number;
};

/**
 * Keyset cursors travel in the URL, so they are encoded rather than exposing a
 * raw timestamp pair that would be easy to hand-edit into an invalid state.
 */
export function encodeRosterCursor(cursor: RosterCursor): string {
  return Buffer.from(
    `${cursor.registeredAt.toISOString()}|${cursor.registrationId}`,
    "utf8",
  ).toString("base64url");
}

export function decodeRosterCursor(value: string | undefined): RosterCursor | null {
  if (!value) return null;
  try {
    const [timestamp, registrationId] = Buffer.from(value, "base64url")
      .toString("utf8")
      .split("|");
    if (!timestamp || !registrationId) return null;
    const registeredAt = new Date(timestamp);
    if (Number.isNaN(registeredAt.getTime())) return null;
    return { registeredAt, registrationId };
  } catch {
    return null;
  }
}

/** Renders a stored answer value for display without inventing structure. */
function formatAnswerValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) {
    return value.length > 0 ? value.map(String).join(", ") : "—";
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const text = String(value).trim();
  return text.length > 0 ? text : "—";
}

/**
 * Takes its database handle so integration tests can pass a transaction and
 * roll back, the way the application services in `features/*​/server` do.
 * `queryEventRoster` in this directory binds it to the real `db`.
 */
export async function getEventRoster({
  db,
  eventId,
  actorUserId,
  searchQuery,
  filter,
  cursor,
  now = new Date(),
}: {
  db: typeof database;
  eventId: string;
  actorUserId: string;
  searchQuery?: string;
  filter?: RosterFilter;
  cursor?: RosterCursor | null;
  now?: Date;
}): Promise<EventRoster | null> {
  const activeFilter = filter ?? "all";
  const trimmedQuery = searchQuery?.trim() ?? "";

  // Organizer or Owner only. CONTEXT.md denies Check-in Volunteers "the full
  // attendee export", and this is that data.
  const [authorized] = await db
    .select({ id: event.id })
    .from(eventStaff)
    .innerJoin(event, eq(event.id, eventStaff.eventId))
    .where(
      and(
        eq(event.id, eventId),
        eq(eventStaff.userId, actorUserId),
        inArray(eventStaff.role, ["owner", "organizer"]),
      ),
    )
    .limit(1);
  if (!authorized) return null;

  // An active Check-in reaches Registration only through its Ticket, so the
  // derived "checked in" filter needs a correlated EXISTS rather than a column.
  const hasActiveCheckInSql = exists(
    db
      .select({ one: sql`1` })
      .from(ticket)
      .innerJoin(
        checkIn,
        and(eq(checkIn.ticketId, ticket.id), isNull(checkIn.invalidatedAt)),
      )
      .where(eq(ticket.registrationId, registration.id)),
  );

  const filterCondition = (() => {
    switch (activeFilter) {
      case "all":
        return undefined;
      case "checked_in":
        return and(eq(registration.status, "confirmed"), hasActiveCheckInSql);
      case "confirmed":
        // "Confirmed" in the UI means confirmed but not yet through the gate;
        // "Checked in" is its own filter, and overlapping them would make the
        // counts add up to more than the roster.
        return and(
          eq(registration.status, "confirmed"),
          sql`not ${hasActiveCheckInSql}`,
        );
      default:
        return eq(registration.status, activeFilter);
    }
  })();

  const searchCondition =
    trimmedQuery.length > 0
      ? or(
          ilike(registration.attendeeName, `%${trimmedQuery}%`),
          ilike(registration.email, `%${trimmedQuery}%`),
        )
      : undefined;

  const scopeCondition = eq(registration.eventId, eventId);
  const matchCondition = and(scopeCondition, filterCondition, searchCondition);

  // Newest first, keyed on (created_at, id) so the pair is unique and paging
  // cannot skip or repeat a row when timestamps collide.
  const pageCondition = cursor
    ? and(
        matchCondition,
        or(
          lt(registration.createdAt, cursor.registeredAt),
          and(
            eq(registration.createdAt, cursor.registeredAt),
            lt(registration.id, cursor.registrationId),
          ),
        ),
      )
    : matchCondition;

  const [pageRows, [matching], [total]] = await Promise.all([
    db
      .select({
        id: registration.id,
        attendeeName: registration.attendeeName,
        email: registration.email,
        status: registration.status,
        source: registration.source,
        createdAt: registration.createdAt,
      })
      .from(registration)
      .where(pageCondition)
      .orderBy(desc(registration.createdAt), desc(registration.id))
      // One extra row tells us whether a further page exists without a second
      // count query.
      .limit(ROSTER_PAGE_SIZE + 1),
    db
      .select({ value: count() })
      .from(registration)
      .where(matchCondition),
    db.select({ value: count() }).from(registration).where(scopeCondition),
  ]);

  const hasMore = pageRows.length > ROSTER_PAGE_SIZE;
  const visibleRows = hasMore ? pageRows.slice(0, ROSTER_PAGE_SIZE) : pageRows;
  const registrationIds = visibleRows.map((row) => row.id);

  if (registrationIds.length === 0) {
    return {
      rows: [],
      nextCursor: null,
      matchingCount: matching?.value ?? 0,
      totalCount: total?.value ?? 0,
    };
  }

  // Batch every dependent read over the page's ids. Plan 004 replaced
  // query-per-item loops elsewhere for the same reason; this avoids
  // reintroducing them.
  const [ticketRows, checkInRows, holdRows, offerRows, answerRows] =
    await Promise.all([
      db
        .select({
          id: ticket.id,
          registrationId: ticket.registrationId,
          code: ticket.code,
          status: ticket.status,
          createdAt: ticket.createdAt,
        })
        .from(ticket)
        .where(inArray(ticket.registrationId, registrationIds))
        .orderBy(desc(ticket.createdAt), desc(ticket.id)),
      db
        .select({
          registrationId: ticket.registrationId,
          checkedInAt: checkIn.checkedInAt,
          invalidatedAt: checkIn.invalidatedAt,
        })
        .from(checkIn)
        .innerJoin(ticket, eq(ticket.id, checkIn.ticketId))
        .where(inArray(ticket.registrationId, registrationIds)),
      db
        .select({
          registrationId: capacityHold.registrationId,
          expiresAt: capacityHold.expiresAt,
          claimedAt: capacityHold.claimedAt,
        })
        .from(capacityHold)
        .where(inArray(capacityHold.registrationId, registrationIds)),
      db
        .select({
          registrationId: admissionOffer.registrationId,
          status: admissionOffer.status,
          expiresAt: admissionOffer.expiresAt,
        })
        .from(admissionOffer)
        .where(inArray(admissionOffer.registrationId, registrationIds)),
      db
        .select({
          registrationId: registrationAnswer.registrationId,
          fieldId: registrationAnswer.fieldId,
          label: registrationField.label,
          archived: registrationField.archived,
          position: registrationField.position,
          value: registrationAnswer.value,
        })
        .from(registrationAnswer)
        .innerJoin(
          registrationField,
          eq(registrationField.id, registrationAnswer.fieldId),
        )
        .where(inArray(registrationAnswer.registrationId, registrationIds))
        .orderBy(asc(registrationField.position)),
    ]);

  // Ticket rows arrive newest-first, so the first one seen per Registration is
  // the latest — the same rule `exportRegistrations` applies.
  const latestTicket = new Map<string, (typeof ticketRows)[number]>();
  for (const row of ticketRows) {
    if (!latestTicket.has(row.registrationId)) {
      latestTicket.set(row.registrationId, row);
    }
  }

  const activeCheckInAt = new Map<string, Date>();
  const reversedCheckIn = new Set<string>();
  for (const row of checkInRows) {
    if (row.invalidatedAt === null) {
      const existing = activeCheckInAt.get(row.registrationId);
      if (!existing || row.checkedInAt > existing) {
        activeCheckInAt.set(row.registrationId, row.checkedInAt);
      }
    } else {
      reversedCheckIn.add(row.registrationId);
    }
  }

  const holdByRegistration = new Map(
    holdRows.map((row) => [row.registrationId, row]),
  );
  const offerByRegistration = new Map(
    offerRows.map((row) => [row.registrationId, row]),
  );

  const answersByRegistration = new Map<string, RosterAnswer[]>();
  for (const row of answerRows) {
    const bucket = answersByRegistration.get(row.registrationId) ?? [];
    bucket.push({
      fieldId: row.fieldId,
      label: row.label,
      archived: row.archived,
      value: formatAnswerValue(row.value),
    });
    answersByRegistration.set(row.registrationId, bucket);
  }

  const rows: RosterRow[] = visibleRows.map((row) => {
    const ticketRow = latestTicket.get(row.id) ?? null;
    const hold = holdByRegistration.get(row.id);
    const offer = offerByRegistration.get(row.id);
    const checkedInAt = activeCheckInAt.get(row.id) ?? null;

    return {
      registrationId: row.id,
      attendeeName: row.attendeeName,
      email: row.email,
      source: row.source as RosterRow["source"],
      registeredAt: row.createdAt,
      ticketCode: ticketRow?.code ?? null,
      checkedInAt,
      // These columns are `text` with database check constraints rather than
      // Postgres enums, so Drizzle infers `string` and the narrowing has to
      // happen here. The constraints are the source of truth.
      status: resolveRosterStatus(
        {
          registrationStatus: row.status as RegistrationStatus,
          ticketStatus: (ticketRow?.status as TicketStatus | undefined) ?? null,
          hasActiveCheckIn: checkedInAt !== null,
          hasReversedCheckIn: reversedCheckIn.has(row.id),
          capacityHold: hold
            ? { expiresAt: hold.expiresAt, claimedAt: hold.claimedAt }
            : null,
          admissionOffer: offer
            ? {
                status: offer.status as AdmissionOfferStatus,
                expiresAt: offer.expiresAt,
              }
            : null,
        },
        now,
      ),
      answers: answersByRegistration.get(row.id) ?? [],
    };
  });

  const lastRow = visibleRows.at(-1);

  return {
    rows,
    nextCursor:
      hasMore && lastRow
        ? { registeredAt: lastRow.createdAt, registrationId: lastRow.id }
        : null,
    matchingCount: matching?.value ?? 0,
    totalCount: total?.value ?? 0,
  };
}
