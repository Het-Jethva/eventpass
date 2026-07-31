// Not in `actions.ts`: a `"use server"` module may only export async functions,
// so a constant exported from one reaches the client as a server-reference stub
// and `status` reads back `undefined`. See app/tickets/[token]/form-state.ts.

export type SaveRegistrationFormState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialSaveRegistrationFormState: SaveRegistrationFormState = {
  status: "idle",
  message: "",
};
