"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  createStaffInvitation,
  inviteStaffInputSchema,
  proposeOwnershipTransfer,
  removeEventStaff,
  revokeStaffInvitation,
  StaffingConflictError,
} from "@/features/staffing/server/staffing-application";
import { sendStaffInvitationEmail } from "@/lib/email/send-staff-invitation";
import { getActiveStaffSession } from "@/lib/staff-session";

const uuidSchema = z.uuid();

function staffPath(eventId: string, search?: URLSearchParams) {
  const suffix = search?.size ? `?${search.toString()}` : "";
  return `/events/${eventId}/staff${suffix}`;
}

async function getApplicationOrigin() {
  const configured = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return new URL(configured).origin;
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  if (!host) throw new Error("The application origin is not configured.");
  return `${protocol}://${host}`;
}

export async function inviteStaffAction(eventId: string, formData: FormData) {
  const session = await getActiveStaffSession();
  if (!session) redirect("/sign-in");
  const validEventId = uuidSchema.parse(eventId);
  const parsed = inviteStaffInputSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    redirect(
      staffPath(validEventId, new URLSearchParams({ error: "Enter a valid email and role." })),
    );
  }

  let invitation;
  try {
    invitation = await createStaffInvitation(
      validEventId,
      session.user.id,
      parsed.data,
    );
  } catch (error) {
    const message =
      error instanceof StaffingConflictError
        ? error.message
        : "The Staff Invitation could not be created.";
    redirect(staffPath(validEventId, new URLSearchParams({ error: message })));
  }

  let notice = "Staff Invitation sent.";
  try {
    const origin = await getApplicationOrigin();
    await sendStaffInvitationEmail({
      email: invitation.email,
      eventName: invitation.eventName,
      invitationUrl: `${origin}/staff-invitations/${encodeURIComponent(invitation.token)}`,
      role: invitation.role,
    });
  } catch {
    notice = "Staff Invitation saved, but email delivery failed.";
  }
  revalidatePath(staffPath(validEventId));
  redirect(staffPath(validEventId, new URLSearchParams({ notice })));
}

export async function revokeStaffInvitationAction(
  eventId: string,
  invitationId: string,
) {
  const session = await getActiveStaffSession();
  if (!session) redirect("/sign-in");
  const validEventId = uuidSchema.parse(eventId);
  try {
    await revokeStaffInvitation(uuidSchema.parse(invitationId), session.user.id);
  } catch {
    redirect(
      staffPath(validEventId, new URLSearchParams({ error: "The invitation could not be revoked." })),
    );
  }
  revalidatePath(staffPath(validEventId));
  redirect(staffPath(validEventId, new URLSearchParams({ notice: "Staff Invitation revoked." })));
}

export async function removeEventStaffAction(
  eventId: string,
  assignmentId: string,
) {
  const session = await getActiveStaffSession();
  if (!session) redirect("/sign-in");
  const validEventId = uuidSchema.parse(eventId);
  try {
    await removeEventStaff(uuidSchema.parse(assignmentId), session.user.id);
  } catch {
    redirect(
      staffPath(validEventId, new URLSearchParams({ error: "That staff member could not be removed." })),
    );
  }
  revalidatePath(staffPath(validEventId));
  revalidatePath("/events");
  redirect(staffPath(validEventId, new URLSearchParams({ notice: "Event Staff access removed." })));
}

export async function proposeOwnershipTransferAction(
  eventId: string,
  formData: FormData,
) {
  const session = await getActiveStaffSession();
  if (!session) redirect("/sign-in");
  const validEventId = uuidSchema.parse(eventId);
  const proposedOwnerUserId = uuidSchema.safeParse(formData.get("proposedOwnerUserId"));
  if (!proposedOwnerUserId.success) {
    redirect(
      staffPath(validEventId, new URLSearchParams({ error: "Choose an Organizer." })),
    );
  }
  try {
    await proposeOwnershipTransfer(
      validEventId,
      proposedOwnerUserId.data,
      session.user.id,
    );
  } catch {
    redirect(
      staffPath(validEventId, new URLSearchParams({ error: "Ownership Transfer could not be proposed." })),
    );
  }
  revalidatePath(staffPath(validEventId));
  redirect(
    staffPath(validEventId, new URLSearchParams({ notice: "Ownership Transfer proposed for 24 hours." })),
  );
}
