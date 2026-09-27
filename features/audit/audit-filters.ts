/**
 * Audit filter vocabulary, separate from the query so the client controls can
 * import it without pulling Drizzle into the browser bundle.
 */

export const AUDIT_CATEGORIES = [
  "all",
  "privileged",
  "scans",
  "conflicts_reversals",
] as const;

export type AuditCategoryValue = (typeof AUDIT_CATEGORIES)[number];

export const AUDIT_CATEGORY_LABELS: Record<AuditCategoryValue, string> = {
  all: "All activity",
  privileged: "Privileged changes",
  scans: "Scans",
  conflicts_reversals: "Conflicts and reversals",
};

export const AUDIT_SOURCES = ["all", "online", "offline"] as const;

export type AuditSourceValue = (typeof AUDIT_SOURCES)[number];

export const AUDIT_SOURCE_LABELS: Record<AuditSourceValue, string> = {
  all: "Any source",
  online: "Online",
  offline: "Offline",
};

export function parseAuditCategory(value: string | undefined): AuditCategoryValue {
  for (const category of AUDIT_CATEGORIES) {
    if (category === value) return category;
  }
  return "all";
}

export function parseAuditSource(value: string | undefined): AuditSourceValue {
  for (const source of AUDIT_SOURCES) {
    if (source === value) return source;
  }
  return "all";
}
