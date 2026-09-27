import "server-only";

import { db } from "@/lib/db";

import { getEventAuditLog } from "./get-audit-log";

export const queryEventAuditLog = (
  options: Omit<Parameters<typeof getEventAuditLog>[0], "db">,
) => getEventAuditLog({ db, ...options });
