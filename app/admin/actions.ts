"use server";

import { revalidatePath } from "next/cache";

import {
  getEventAttendeeDataForSupport,
  grantSupportAccess,
  reactivateEvent,
  reactivateStaffAccount,
  suspendEvent,
  suspendStaffAccount,
} from "@/features/admin/server/admin-application";
import { getActiveStaffSession } from "@/lib/staff-session";

export async function suspendStaffAccountAction(
  targetUserId: string,
  reason: string,
) {
  const session = await getActiveStaffSession();
  if (!session) throw new Error("Unauthorized");

  await suspendStaffAccount({
    actorUserId: session.user.id,
    targetUserId,
    reason,
  });

  revalidatePath("/admin");
}

export async function reactivateStaffAccountAction(
  targetUserId: string,
  reason: string,
) {
  const session = await getActiveStaffSession();
  if (!session) throw new Error("Unauthorized");

  await reactivateStaffAccount({
    actorUserId: session.user.id,
    targetUserId,
    reason,
  });

  revalidatePath("/admin");
}

export async function suspendEventAction(
  eventId: string,
  reason: string,
) {
  const session = await getActiveStaffSession();
  if (!session) throw new Error("Unauthorized");

  await suspendEvent({
    actorUserId: session.user.id,
    eventId,
    reason,
  });

  revalidatePath("/admin");
}

export async function reactivateEventAction(
  eventId: string,
  reason: string,
) {
  const session = await getActiveStaffSession();
  if (!session) throw new Error("Unauthorized");

  await reactivateEvent({
    actorUserId: session.user.id,
    eventId,
    reason,
  });

  revalidatePath("/admin");
}

export async function grantSupportAccessAction(
  eventId: string,
  reason: string,
) {
  const session = await getActiveStaffSession();
  if (!session) throw new Error("Unauthorized");

  await grantSupportAccess({
    actorUserId: session.user.id,
    eventId,
    reason,
  });

  revalidatePath("/admin");
}

export async function fetchSupportAttendeeDataAction(eventId: string) {
  const session = await getActiveStaffSession();
  if (!session) throw new Error("Unauthorized");

  return getEventAttendeeDataForSupport({
    actorUserId: session.user.id,
    eventId,
  });
}
