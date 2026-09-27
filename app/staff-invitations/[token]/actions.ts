"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { acceptStaffInvitation } from "@/features/staffing/server/staffing-application";
import { staffEventHomePath } from "@/features/staffing/staffing-policy";
import { getActiveStaffSession } from "@/lib/staff-session";

export async function acceptStaffInvitationAction(token: string) {
  const session = await getActiveStaffSession();
  if (!session) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/staff-invitations/${token}`)}`);
  }
  let result;
  try {
    result = await acceptStaffInvitation(token, session.user.id);
  } catch {
    redirect(`/staff-invitations/${token}?error=unavailable`);
  }
  revalidatePath("/events");
  revalidatePath(`/events/${result.eventId}/staff`);
  redirect(staffEventHomePath(result.role, result.eventId));
}
