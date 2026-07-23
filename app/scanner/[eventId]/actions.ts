"use server";

import { z } from "zod";

import { admitOnline } from "@/features/admission/server/admission";
import type { AdmissionResult } from "@/features/admission/server/admission-application";
import type { ScannerPreparationResult } from "@/features/admission/offline-snapshot";
import { prepareOfflineScanner } from "@/features/admission/server/prepare-scanner";
import { getActiveStaffSession } from "@/lib/staff-session";

const scanInputSchema = z.object({
  eventId: z.uuid(),
  clientAttemptId: z.uuid(),
  input: z.string().trim().min(1).max(4096),
  inputMethod: z.enum(["camera", "manual"]),
});

const scannerPreparationSchema = z.object({
  eventId: z.uuid(),
  scannerDeviceId: z.uuid(),
  scannerDeviceLabel: z.string().trim().min(2).max(80),
});

export async function scanTicketAction(values: {
  eventId: string;
  clientAttemptId: string;
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

export async function prepareOfflineScannerAction(values: {
  eventId: string;
  scannerDeviceId: string;
  scannerDeviceLabel: string;
}): Promise<ScannerPreparationResult> {
  const session = await getActiveStaffSession();
  if (!session) return { outcome: "unauthorized" };
  const parsed = scannerPreparationSchema.safeParse(values);
  if (!parsed.success) return { outcome: "event_unavailable" };

  return prepareOfflineScanner({
    ...parsed.data,
    actorUserId: session.user.id,
  });
}
