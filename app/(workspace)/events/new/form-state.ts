// Not in `actions.ts`: a `"use server"` module may only export async functions,
// so a constant exported from one reaches the client as a server-reference stub
// and `status` reads back `undefined`. See app/tickets/[token]/form-state.ts.

import type { CreateDraftEventInput } from "@/features/events/server/create-draft-event";

export type CreateEventFormField = keyof CreateDraftEventInput;

export type CreateEventFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<CreateEventFormField, string[]>>;
  values?: Record<CreateEventFormField, string>;
};

export const initialCreateEventFormState: CreateEventFormState = {
  status: "idle",
};
