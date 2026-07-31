// Not in `actions.ts`: a `"use server"` module may only export async functions,
// so a constant exported from one reaches the client as a server-reference stub
// and `status` reads back `undefined`. See app/tickets/[token]/form-state.ts.

import type { RegistrationSubmissionValues } from "@/features/registration/registration-submission";

export type RegistrationActionState = {
  status: "idle" | "error" | "existing";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  values?: RegistrationSubmissionValues;
};

export const initialRegistrationActionState: RegistrationActionState = {
  status: "idle",
};
