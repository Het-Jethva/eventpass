// A `"use server"` module may only export async functions: Next replaces every
// other export with a server-reference stub, so a plain object imported from one
// arrives on the client as something whose `.status` is `undefined`. That is not
// a type error — it type-checks perfectly — it just meant every management form
// rendered its failure Alert ("Action not completed") before the attendee had
// touched anything. The shared shape lives here so both sides get the real value.

export type ManagementActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  values?: { name: string; answers: Record<string, unknown> };
};

export const initialManagementActionState: ManagementActionState = {
  status: "idle",
};
