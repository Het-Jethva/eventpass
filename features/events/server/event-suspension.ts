import "server-only";

import { eq } from "drizzle-orm";

import { EventSuspendedError } from "@/features/admin/admin-policy";
import { event } from "@/lib/db/schema";

export { EventSuspendedError } from "@/features/admin/admin-policy";

type EventDatabase = typeof import("@/lib/db").db;
type EventTransaction = Parameters<Parameters<EventDatabase["transaction"]>[0]>[0];

export async function lockEvent(
  transaction: EventTransaction,
  eventId: string,
) {
  const [eventRecord] = await transaction
    .select({ id: event.id, suspended: event.suspended })
    .from(event)
    .where(eq(event.id, eventId))
    .for("update")
    .limit(1);

  return eventRecord ?? null;
}

export function assertEventNotSuspended(eventRecord: { suspended: boolean }) {
  if (eventRecord.suspended) {
    throw new EventSuspendedError();
  }
}

export function isEventSuspended(eventRecord: { suspended: boolean }) {
  return eventRecord.suspended;
}

export async function lockEventForMutation(
  transaction: EventTransaction,
  eventId: string,
) {
  const eventRecord = await lockEvent(transaction, eventId);
  if (eventRecord) {
    assertEventNotSuspended(eventRecord);
  }
  return eventRecord;
}
