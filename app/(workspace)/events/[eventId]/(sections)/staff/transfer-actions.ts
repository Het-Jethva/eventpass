"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { acceptOwnershipTransfer } from "@/features/staffing/server/staffing-application";
import { getActiveStaffSession } from "@/lib/staff-session";

export async function acceptOwnershipTransferAction(
  eventId: string,
  transferId: string,
) {
  const session = await getActiveStaffSession();
  if (!session) redirect("/sign-in");
  try {
    await acceptOwnershipTransfer(transferId, session.user.id);
  } catch {
    redirect(`/events/${eventId}/staff?error=Ownership+Transfer+could+not+be+accepted.`);
  }
  revalidatePath("/events");
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/staff`);
  redirect(`/events/${eventId}/staff?notice=You+are+now+the+Event+Owner.`);
}
