import { and, eq, inArray, sql } from "drizzle-orm";

import {
  isSensitiveAuditField,
  sanitizeAuditEntryMetadata,
} from "@/features/audit/audit-privacy-policy";
import type { db as database } from "@/lib/db";
import { eventStaff } from "@/lib/db/schema";

export { isSensitiveAuditField, sanitizeAuditEntryMetadata };

export type AuditCategory = "all" | "privileged" | "scans" | "conflicts_reversals";
export type AuditSourceFilter = "all" | "online" | "offline";

export const AUDIT_PAGE_SIZE = 50;

export type FormattedAuditRecord = {
  id: string;
  category: "privileged" | "scan";
  action: string;
  actionLabel: string;
  actorName: string;
  actorEmail?: string;
  targetType: string;
  targetId: string;
  targetLabel?: string;
  reason?: string;
  source: "online" | "offline";
  timestampConfidence?: "high" | "low" | null;
  scannerDeviceId?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AuditCursor = { at: Date; id: string };

export type EventAuditLog = {
  records: FormattedAuditRecord[];
  nextCursor: AuditCursor | null;
  /** Entries matching the current filters, across all pages. */
  matchingCount: number;
  /** Entries for the Event regardless of filters. */
  totalCount: number;
};

export function encodeAuditCursor(cursor: AuditCursor): string {
  return Buffer.from(`${cursor.at.toISOString()}|${cursor.id}`, "utf8").toString(
    "base64url",
  );
}

export function decodeAuditCursor(value: string | undefined): AuditCursor | null {
  if (!value) return null;
  try {
    const [timestamp, id] = Buffer.from(value, "base64url")
      .toString("utf8")
      .split("|");
    if (!timestamp || !id) return null;
    const at = new Date(timestamp);
    if (Number.isNaN(at.getTime())) return null;
    return { at, id };
  } catch {
    return null;
  }
}

type AuditRow = {
  id: string;
  category: "privileged" | "scan";
  action: string;
  actor_name: string;
  actor_email: string | null;
  target_type: string;
  target_id: string;
  target_label: string | null;
  reason: string | null;
  source: "online" | "offline";
  timestamp_confidence: "high" | "low" | null;
  scanner_device_id: string | null;
  metadata: Record<string, unknown> | null;
  input_method: string | null;
  sort_at: string | Date;
};

/**
 * Audit Entries and Scan Attempts unified in SQL rather than merged in
 * TypeScript.
 *
 * The previous implementation read the most recent 200 Audit Entries and 300
 * Scan Attempts, then filtered and searched that array in the browser. On a busy
 * Event the search box therefore searched a truncated window while presenting
 * itself as searching the log — the opposite of the honesty CONTEXT.md asks for
 * around state. Filtering, searching and paging now all happen in Postgres over
 * the full log.
 *
 * Takes its database handle so integration tests can pass a transaction.
 */
export async function getEventAuditLog({
  db,
  eventId,
  actorUserId,
  category = "all",
  source = "all",
  searchQuery = "",
  cursor = null,
}: {
  db: typeof database;
  eventId: string;
  actorUserId: string;
  category?: AuditCategory;
  source?: AuditSourceFilter;
  searchQuery?: string;
  cursor?: AuditCursor | null;
}): Promise<EventAuditLog> {
  const [assignment] = await db
    .select({ role: eventStaff.role })
    .from(eventStaff)
    .where(
      and(
        eq(eventStaff.eventId, eventId),
        eq(eventStaff.userId, actorUserId),
        inArray(eventStaff.role, ["owner", "organizer"]),
      ),
    )
    .limit(1);

  if (!assignment) {
    return { records: [], nextCursor: null, matchingCount: 0, totalCount: 0 };
  }

  // Both sources are normalized to one column list so they can be unioned. The
  // explicit casts are required: Postgres needs matching types across a UNION,
  // and a bare NULL has none.
  const unified = sql`
    select
      ae.id::text as id,
      'privileged'::text as category,
      ae.action::text as action,
      u.name::text as actor_name,
      u.email::text as actor_email,
      ae.target_type::text as target_type,
      ae.target_id::text as target_id,
      (ae.target_type || ':' || left(ae.target_id::text, 8))::text as target_label,
      ae.reason::text as reason,
      'online'::text as source,
      null::text as timestamp_confidence,
      null::text as scanner_device_id,
      coalesce(ae.metadata, '{}'::jsonb) as metadata,
      null::text as input_method,
      ae.created_at as sort_at
    from audit_entry ae
    join "user" u on u.id = ae.actor_user_id
    where ae.event_id = ${eventId}

    union all

    select
      sa.id::text as id,
      'scan'::text as category,
      ('scan_attempt.' || sa.outcome)::text as action,
      u.name::text as actor_name,
      null::text as actor_email,
      'ticket'::text as target_type,
      coalesce(t.code, 'unknown')::text as target_id,
      (case when t.code is null then 'Unrecognized code'
            else t.code end)::text as target_label,
      null::text as reason,
      sa.source::text as source,
      sa.timestamp_confidence::text as timestamp_confidence,
      sa.scanner_device_id::text as scanner_device_id,
      '{}'::jsonb as metadata,
      sa.input_method::text as input_method,
      sa.attempted_at as sort_at
    from scan_attempt sa
    join "user" u on u.id = sa.actor_user_id
    left join ticket t on t.id = sa.ticket_id
    where sa.event_id = ${eventId}
  `;

  const categoryFilter = (() => {
    switch (category) {
      case "privileged":
        return sql`and category = 'privileged'`;
      case "scans":
        return sql`and category = 'scan'`;
      case "conflicts_reversals":
        // Conflict resolutions and reversals live in both sources, so this
        // spans them rather than picking a category.
        return sql`and (action like '%conflict%' or action like '%reversal%')`;
      default:
        return sql``;
    }
  })();

  const sourceFilter =
    source === "all" ? sql`` : sql`and source = ${source}`;

  const trimmedQuery = searchQuery.trim();
  const searchFilter =
    trimmedQuery.length > 0
      ? sql`and (
          actor_name ilike ${`%${trimmedQuery}%`}
          or coalesce(actor_email, '') ilike ${`%${trimmedQuery}%`}
          or action ilike ${`%${trimmedQuery}%`}
          or coalesce(target_label, '') ilike ${`%${trimmedQuery}%`}
          or target_id ilike ${`%${trimmedQuery}%`}
          or coalesce(reason, '') ilike ${`%${trimmedQuery}%`}
        )`
      : sql``;

  // Keyset on (sort_at, id): the id tiebreaker matters because a synchronized
  // batch of Scan Attempts can share a timestamp.
  const pageFilter = cursor
    ? sql`and (sort_at, id) < (${cursor.at.toISOString()}::timestamptz, ${cursor.id})`
    : sql``;

  const filters = sql`${categoryFilter} ${sourceFilter} ${searchFilter}`;

  const [pageResult, countResult] = await Promise.all([
    db.execute(sql`
      with unified as (${unified})
      select * from unified
      where true ${filters} ${pageFilter}
      order by sort_at desc, id desc
      limit ${AUDIT_PAGE_SIZE + 1}
    `),
    db.execute(sql`
      with unified as (${unified})
      select
        count(*) filter (where true ${filters})::int as matching,
        count(*)::int as total
      from unified
    `),
  ]);

  const pageRows = (pageResult.rows ?? []) as unknown as AuditRow[];
  const counts = (countResult.rows?.[0] ?? { matching: 0, total: 0 }) as {
    matching: number;
    total: number;
  };

  const hasMore = pageRows.length > AUDIT_PAGE_SIZE;
  const visibleRows = hasMore ? pageRows.slice(0, AUDIT_PAGE_SIZE) : pageRows;
  const lastRow = visibleRows.at(-1);

  return {
    records: visibleRows.map(toFormattedRecord),
    nextCursor:
      hasMore && lastRow
        ? { at: new Date(lastRow.sort_at), id: lastRow.id }
        : null,
    matchingCount: counts.matching,
    totalCount: counts.total,
  };
}

function toFormattedRecord(row: AuditRow): FormattedAuditRecord {
  const isScan = row.category === "scan";

  return {
    id: row.id,
    category: row.category,
    action: row.action,
    actionLabel: isScan
      ? formatScanOutcomeLabel(row.action.replace("scan_attempt.", ""))
      : formatAuditActionLabel(row.action),
    actorName: row.actor_name,
    actorEmail: row.actor_email ?? undefined,
    targetType: row.target_type,
    targetId: row.target_id,
    targetLabel: row.target_label ?? undefined,
    reason: row.reason ?? undefined,
    source: row.source,
    timestampConfidence: row.timestamp_confidence,
    scannerDeviceId: row.scanner_device_id,
    // A scan's only detail is how the code got in. It used to reach the table
    // as the raw column name, so organizers read "inputMethod: camera".
    metadata: isScan
      ? { "Read by": row.input_method === "manual" ? "typing" : "camera" }
      : sanitizeAuditEntryMetadata(row.metadata ?? {}),
    createdAt: new Date(row.sort_at).toISOString(),
  };
}

// Sentence case throughout, like every other string in the product. These read
// down a column of forty rows, so each one names the change and stops.
function formatAuditActionLabel(action: string): string {
  const labels: Record<string, string> = {
    "event.created": "Event created",
    "event.updated": "Event configured",
    "event.published": "Event published",
    "event.canceled": "Event canceled",
    "staff_invitation.created": "Invitation sent",
    "staff_invitation.accepted": "Invitation accepted",
    "staff_invitation.revoked": "Invitation revoked",
    "event_staff.removed": "Staff removed",
    "ownership_transfer.proposed": "Ownership transfer proposed",
    "ownership_transfer.accepted": "Ownership transferred",
    "ownership_transfer.revoked": "Ownership transfer revoked",
    "check_in_reversal.created": "Check-in reversed",
    "check_in_conflict.resolved": "Conflict resolved",
    "registration_import.completed": "Registrations imported",
    admission_override: "Check-in window overridden",
  };

  return labels[action] ?? sentenceCase(action.replace(/[._]/g, " "));
}

function formatScanOutcomeLabel(outcome: string): string {
  const labels: Record<string, string> = {
    accepted: "Scan accepted",
    duplicate: "Scan repeated",
    invalid: "Scan invalid",
    unknown: "Scan not recognized",
    canceled: "Ticket canceled",
    replaced: "Ticket replaced",
    expired: "Ticket expired",
    outside_window: "Outside check-in window",
    conflict: "Scan conflict",
  };

  return labels[outcome] ?? sentenceCase(outcome.replace(/_/g, " "));
}

function sentenceCase(value: string): string {
  const trimmed = value.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
