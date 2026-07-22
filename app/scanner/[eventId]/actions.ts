"use server";

import { z } from "zod";

import { admitOnline } from "@/features/admission/server/admission";
import type { AdmissionResult } from "@/features/admission/server/admission-application";
import { getActiveStaffSession } from "@/lib/staff-session";

const scanInputSchema = z.object({
  eventId: z.uuid(),
  input: z.string().trim().min(1).max(4096),
  inputMethod: z.enum(["camera", "manual"]),
});

export async function scanTicketAction(values: {
  eventId: string;
  input: string;
  inputMethod: "camera" | "manual";
}): Promise<AdmissionResult> {
  const session = await getActiveStaffSession();
  if (!session) return { outcome: "unauthorized" };
  const parsed = scanInputSchema.safeParse(values);
  if (!parsed.success) return { outcome: "invalid" };

  return admitOnline({
    ...parsed.data,
    actorUserId: session.user.id,
  });
}
