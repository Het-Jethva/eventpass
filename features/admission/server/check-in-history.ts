import "server-only";

import { desc, eq, inArray } from "drizzle-orm";

import type { DatabaseClient } from "@/lib/db";
import { checkIn, checkInReversal } from "@/lib/db/schema";

export async function getLatestCheckInReversals(
  reader: Pick<DatabaseClient, "select">,
  ticketIds: string[],
) {
  const latestByTicket = new Map<string, Date>();
  if (ticketIds.length === 0) return latestByTicket;

  const reversals = await reader
    .select({ ticketId: checkIn.ticketId, createdAt: checkInReversal.createdAt })
    .from(checkInReversal)
    .innerJoin(checkIn, eq(checkIn.id, checkInReversal.checkInId))
    .where(inArray(checkIn.ticketId, ticketIds))
    .orderBy(desc(checkInReversal.createdAt));
  for (const reversal of reversals) {
    if (!latestByTicket.has(reversal.ticketId)) {
      latestByTicket.set(reversal.ticketId, reversal.createdAt);
    }
  }
  return latestByTicket;
}
