import type {
  AdmissionInput,
  AdmissionResult,
} from "./server/admission-application";

type ScannerAdmissionInput = Omit<AdmissionInput, "actorUserId">;

const ONLINE_ADMISSION_TIMEOUT_MS = 5_000;

export async function admitWithOfflineFallback(
  input: ScannerAdmissionInput,
  dependencies: {
    online: boolean;
    admitOnline: (input: ScannerAdmissionInput) => Promise<AdmissionResult>;
    admitOffline: (input: ScannerAdmissionInput) => Promise<AdmissionResult>;
  },
): Promise<{ source: "online" | "offline"; result: AdmissionResult }> {
  if (dependencies.online) {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        dependencies.admitOnline(input),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error("Online admission timed out.")),
            ONLINE_ADMISSION_TIMEOUT_MS,
          );
        }),
      ]);
      return { source: "online", result };
    } catch (error) {
      if (input.overrideReason) throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  if (input.overrideReason) {
    throw new Error("Online access is required for an override.");
  }
  return { source: "offline", result: await dependencies.admitOffline(input) };
}
