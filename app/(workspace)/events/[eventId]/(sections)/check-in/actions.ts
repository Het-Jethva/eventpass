"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  CheckInConflictError,
  resolveCheckInConflict,
} from "@/features/admission/server/synchronize-offline";
import {
  CheckInCorrectionError,
  reverseCheckIn,
} from "@/features/admission/server/check-in-corrections";
import { EventSuspendedError } from "@/features/events/server/event-suspension";
import { getActiveStaffSession } from "@/lib/staff-session";

const resolutionSchema = z.object({
  eventId: z.uuid(),
  conflictId: z.uuid(),
  authoritativeAttemptId: z.uuid(),
  reason: z
    .string()
    .trim()
    .min(1, "Explain why this Scan Attempt should be authoritative.")
    .max(500, "Keep the resolution reason under 500 characters."),
});

const reversalSchema = z.object({
  eventId: z.uuid(),
  checkInId: z.uuid(),
  reason: z.string().trim().min(1).max(500),
});

function conflictPath(eventId: string, query?: URLSearchParams) {
  const suffix = query?.size ? `?${query.toString()}` : "";
  return `/events/${eventId}/check-in${suffix}`;
}

export async function resolveCheckInConflictAction(
  eventId: string,
  conflictId: string,
  formData: FormData,
) {
  const session = await getActiveStaffSession();
  if (!session) redirect("/sign-in");

  const parsed = resolutionSchema.safeParse({
    eventId,
    conflictId,
    authoritativeAttemptId: formData.get("authoritativeAttemptId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    redirect(
      conflictPath(
        eventId,
        new URLSearchParams({
          error:
            parsed.error.issues[0]?.message ??
            "Choose a Scan Attempt and provide a reason.",
        }),
      ),
    );
  }

  try {
    await resolveCheckInConflict({
      conflictId: parsed.data.conflictId,
      actorUserId: session.user.id,
      authoritativeAttemptId: parsed.data.authoritativeAttemptId,
      reason: parsed.data.reason,
    });
  } catch (error) {
    redirect(
      conflictPath(
        parsed.data.eventId,
        new URLSearchParams({
          error:
            error instanceof CheckInConflictError ||
            error instanceof EventSuspendedError
              ? error.message
              : "The Check-in Conflict could not be resolved.",
        }),
      ),
    );
  }

  const path = conflictPath(parsed.data.eventId);
  revalidatePath(path);
  revalidatePath(`/events/${parsed.data.eventId}`);
  redirect(
    conflictPath(
      parsed.data.eventId,
      new URLSearchParams({ notice: "Check-in Conflict resolved." }),
    ),
  );
}

export async function reverseOrganizerCheckInAction(
  eventId: string,
  checkInId: string,
  reason: string,
) {
  const session = await getActiveStaffSession();
  if (!session) {
    return {
      outcome: "error" as const,
      message: "Sign in again to reverse this Check-in.",
    };
  }
  const parsed = reversalSchema.safeParse({ eventId, checkInId, reason });
  if (!parsed.success) {
    return {
      outcome: "error" as const,
      message: "Provide a concise reversal reason.",
    };
  }
  try {
    await reverseCheckIn({ ...parsed.data, actorUserId: session.user.id });
  } catch (error) {
    return {
      outcome: "error" as const,
      message:
        error instanceof CheckInCorrectionError ||
        error instanceof EventSuspendedError
          ? error.message
          : "This Check-in could not be reversed.",
    };
  }
  revalidatePath(`/events/${eventId}/check-in`);
  revalidatePath(`/events/${eventId}`);
  return { outcome: "reversed" as const };
}
