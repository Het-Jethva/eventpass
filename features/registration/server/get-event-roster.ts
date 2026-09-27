import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";

import type { DatabaseClient } from "@/lib/db";
import {
  admissionOffer,
  capacityHold,
  checkIn,
  event,
  eventStaff,
  registration,
  registrationAnswer,
  registrationField,
  registrationFieldChoice,
  ticket,
} from "@/lib/db/schema";
import { escapeLikePattern } from "@/lib/like-pattern";
import type { RosterFilter } from "@/features/registration/roster-filters";
import {
  parseAdmissionOfferStatus,
  parseRegistrationSource,
  parseRegistrationStatus,
  parseTicketStatus,
  resolveRosterStatus,
  type RegistrationSource,
  type RosterStatus,
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
  source: RegistrationSource;
  registeredAt: Date;
  status: RosterStatus;
  ticketCode: string | null;
  checkedInAt: Date | null;
  answers: RosterAnswer[];
};

export type RosterCursor = { registeredAt: string; registrationId: string };

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
 *
 * `registeredAt` is the UTC text Postgres produced
 * (`2030-05-14T09:00:00.123456Z`), not a Date. JavaScript dates keep only
 * milliseconds, and a truncated cursor drops every later Registration in that
 * millisecond.
 */
export function encodeRosterCursor(cursor: RosterCursor): string {
  return Buffer.from(
    `${cursor.registeredAt}|${cursor.registrationId}`,
    "utf8",
  ).toString("base64url");
}

/** Milliseconds from `Date#toISOString()`, or microseconds from `to_char`. */
const CURSOR_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{6}|\d{3})Z$/;

function cursorTimestamp(value: string): string | null {
  const match = CURSOR_TIMESTAMP.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day ||
    parsed.getUTCHours() !== hour ||
    parsed.getUTCMinutes() !== minute ||
    parsed.getUTCSeconds() !== second
  ) {
    return null;
  }
  return value;
}

export function decodeRosterCursor(value: string | undefined): RosterCursor | null {
  if (!value) return null;
  try {
    const [timestamp, registrationId] = Buffer.from(value, "base64url")
      .toString("utf8")
      .split("|");
    if (!timestamp || !registrationId) return null;
    const registeredAt = cursorTimestamp(timestamp);
    if (!registeredAt) return null;
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
 * Choice answers store option ids. A missing label keeps the stored id, the
 * same fallback the CSV export uses.
 */
function resolveChoiceAnswerValue(
  value: unknown,
  choiceLabels: ReadonlyMap<string, string>,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) =>
      typeof item === "string" ? (choiceLabels.get(item) ?? item) : item,
    );
  }
  if (typeof value === "string") {
    return choiceLabels.get(value) ?? value;
  }
  return value;
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
  db: DatabaseClient;
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

  const likePattern =
    trimmedQuery.length > 0 ? `%${escapeLikePattern(trimmedQuery)}%` : null;
  const searchCondition = likePattern
    ? or(
        sql`${registration.attendeeName} ilike ${likePattern} escape '\\'`,
        sql`${registration.email} ilike ${likePattern} escape '\\'`,
      )
    : undefined;

  const scopeCondition = eq(registration.eventId, eventId);
  const matchCondition = and(scopeCondition, filterCondition, searchCondition);

  // Newest first, keyed on (created_at, id) so the pair is unique and paging
  // cannot skip or repeat a row when timestamps collide. The cursor text is
  // cast back to timestamptz so microseconds still match the stored value.
  const pageCondition = cursor
    ? and(
        matchCondition,
        or(
          sql`${registration.createdAt} < ${cursor.registeredAt}::timestamptz`,
          and(
            sql`${registration.createdAt} = ${cursor.registeredAt}::timestamptz`,
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
        registeredAtText: sql<string>`to_char(${registration.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`.mapWith(
          String,
        ),
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
          answerType: registrationField.answerType,
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

  // Labels for the choice fields on this page only, including archived
  // options, so an old answer still shows the option the attendee picked.
  const choiceFieldIds = [
    ...new Set(
      answerRows
        .filter(
          (row) =>
            row.answerType === "single_choice" ||
            row.answerType === "multiple_choice",
        )
        .map((row) => row.fieldId),
    ),
  ];
  const choiceRows =
    choiceFieldIds.length === 0
      ? []
      : await db
          .select({
            id: registrationFieldChoice.id,
            label: registrationFieldChoice.label,
          })
          .from(registrationFieldChoice)
          .where(inArray(registrationFieldChoice.fieldId, choiceFieldIds));
  const choiceLabels = new Map(
    choiceRows.map((choice) => [choice.id, choice.label]),
  );

  const answersByRegistration = new Map<string, RosterAnswer[]>();
  for (const row of answerRows) {
    const bucket = answersByRegistration.get(row.registrationId) ?? [];
    const isChoice =
      row.answerType === "single_choice" ||
      row.answerType === "multiple_choice";
    bucket.push({
      fieldId: row.fieldId,
      label: row.label,
      archived: row.archived,
      value: formatAnswerValue(
        isChoice ? resolveChoiceAnswerValue(row.value, choiceLabels) : row.value,
      ),
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
      source: parseRegistrationSource(row.source),
      registeredAt: row.createdAt,
      ticketCode: ticketRow?.code ?? null,
      checkedInAt,
      status: resolveRosterStatus(
        {
          registrationStatus: parseRegistrationStatus(row.status),
          ticketStatus: ticketRow ? parseTicketStatus(ticketRow.status) : null,
          hasActiveCheckIn: checkedInAt !== null,
          hasReversedCheckIn: reversedCheckIn.has(row.id),
          capacityHold: hold
            ? { expiresAt: hold.expiresAt, claimedAt: hold.claimedAt }
            : null,
          admissionOffer: offer
            ? {
                status: parseAdmissionOfferStatus(offer.status),
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
        ? {
            registeredAt: lastRow.registeredAtText,
            registrationId: lastRow.id,
          }
        : null,
    matchingCount: matching?.value ?? 0,
    totalCount: total?.value ?? 0,
  };
}
