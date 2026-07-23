import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";

import {
  isSensitiveAuditField,
  sanitizeAuditEntryMetadata,
} from "@/features/audit/audit-privacy-policy";
import { db } from "@/lib/db";
import {
  auditEntry,
  eventStaff,
  scanAttempt,
  ticket,
  user,
} from "@/lib/db/schema";

export { isSensitiveAuditField, sanitizeAuditEntryMetadata };

export type AuditCategory = "all" | "privileged" | "scans" | "conflicts_reversals";
export type AuditSourceFilter = "all" | "online" | "offline";

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

export async function getEventAuditLog({
  eventId,
  actorUserId,
  category = "all",
  source = "all",
}: {
  eventId: string;
  actorUserId: string;
  category?: AuditCategory;
  source?: AuditSourceFilter;
}): Promise<FormattedAuditRecord[]> {
  // Authorization check
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

  if (!assignment) return [];

  const records: FormattedAuditRecord[] = [];

  // 1. Privileged changes from audit_entry
  if (category === "all" || category === "privileged" || category === "conflicts_reversals") {
    const rawEntries = await db
      .select({
        id: auditEntry.id,
        action: auditEntry.action,
        targetType: auditEntry.targetType,
        targetId: auditEntry.targetId,
        reason: auditEntry.reason,
        metadata: auditEntry.metadata,
        createdAt: auditEntry.createdAt,
        actorName: user.name,
        actorEmail: user.email,
      })
      .from(auditEntry)
      .innerJoin(user, eq(user.id, auditEntry.actorUserId))
      .where(eq(auditEntry.eventId, eventId))
      .orderBy(desc(auditEntry.createdAt))
      .limit(200);

    for (const entry of rawEntries) {
      if (
        category === "conflicts_reversals" &&
        !entry.action.includes("conflict") &&
        !entry.action.includes("reversal")
      ) {
        continue;
      }

      records.push({
        id: entry.id,
        category: "privileged",
        action: entry.action,
        actionLabel: formatAuditActionLabel(entry.action),
        actorName: entry.actorName,
        actorEmail: entry.actorEmail,
        targetType: entry.targetType,
        targetId: entry.targetId,
        targetLabel: `${entry.targetType}:${entry.targetId.slice(0, 8)}`,
        reason: entry.reason ?? undefined,
        source: "online",
        metadata: sanitizeAuditEntryMetadata(
          (entry.metadata as Record<string, unknown>) ?? {},
        ),
        createdAt: entry.createdAt.toISOString(),
      });
    }
  }

  // 2. Scan attempts from scan_attempt
  if (category === "all" || category === "scans" || category === "conflicts_reversals") {
    const rawScans = await db
      .select({
        id: scanAttempt.id,
        outcome: scanAttempt.outcome,
        inputMethod: scanAttempt.inputMethod,
        source: scanAttempt.source,
        scannerDeviceId: scanAttempt.scannerDeviceId,
        attemptedAt: scanAttempt.attemptedAt,
        timestampConfidence: scanAttempt.timestampConfidence,
        actorName: user.name,
        ticketCode: ticket.code,
      })
      .from(scanAttempt)
      .innerJoin(user, eq(user.id, scanAttempt.actorUserId))
      .leftJoin(ticket, eq(ticket.id, scanAttempt.ticketId))
      .where(eq(scanAttempt.eventId, eventId))
      .orderBy(desc(scanAttempt.attemptedAt))
      .limit(300);

    for (const scan of rawScans) {
      if (source !== "all" && scan.source !== source) {
        continue;
      }
      if (category === "conflicts_reversals" && scan.outcome !== "conflict") {
        continue;
      }

      records.push({
        id: scan.id,
        category: "scan",
        action: `scan_attempt.${scan.outcome}`,
        actionLabel: `Scan Attempt: ${scan.outcome.toUpperCase()}`,
        actorName: scan.actorName,
        targetType: "ticket",
        targetId: scan.ticketCode ?? "unknown",
        targetLabel: scan.ticketCode ? `Ticket Code: ${scan.ticketCode}` : "Unknown Input",
        source: scan.source as "online" | "offline",
        timestampConfidence: scan.timestampConfidence as "high" | "low" | null,
        scannerDeviceId: scan.scannerDeviceId,
        metadata: {
          inputMethod: scan.inputMethod,
        },
        createdAt: scan.attemptedAt.toISOString(),
      });
    }
  }

  // Sort unified audit log descending by timestamp
  records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return records;
}

function formatAuditActionLabel(action: string): string {
  const labels: Record<string, string> = {
    "event.created": "Event Created",
    "event.updated": "Event Configured",
    "event.published": "Event Published",
    "event.canceled": "Event Canceled",
    "staff_invitation.created": "Staff Invitation Sent",
    "staff_invitation.accepted": "Staff Invitation Accepted",
    "staff_invitation.revoked": "Staff Invitation Revoked",
    "event_staff.removed": "Event Staff Removed",
    "ownership_transfer.proposed": "Ownership Transfer Proposed",
    "ownership_transfer.accepted": "Ownership Transfer Accepted",
    "ownership_transfer.revoked": "Ownership Transfer Revoked",
    "check_in_reversal.created": "Check-in Reversed",
    "check_in_conflict.resolved": "Check-in Conflict Resolved",
    "registration_import.completed": "Registrations Imported",
    admission_override: "Check-in Window Override",
  };

  return labels[action] ?? action.replace(/_/g, " ").replace(/\./g, ": ");
}
