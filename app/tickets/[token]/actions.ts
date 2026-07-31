"use server";

import { revalidatePath } from "next/cache";

import {
  cancelRegistration,
  replaceTicket,
  resendTicket,
  updateRegistration,
} from "@/features/tickets/server/tickets";

import type { ManagementActionState } from "./form-state";

export type { ManagementActionState };

function stringValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function refreshManagementPage(token: string) {
  revalidatePath(`/tickets/${encodeURIComponent(token)}`);
}

export async function updateRegistrationAction(
  token: string,
  fieldIds: string[],
  _previousState: ManagementActionState,
  formData: FormData,
): Promise<ManagementActionState> {
  const values = {
    name: stringValue(formData, "name"),
    answers: Object.fromEntries(
      fieldIds.map((fieldId) => {
        const answers = formData
          .getAll(`answer.${fieldId}`)
          .filter((value): value is string => typeof value === "string");
        return [fieldId, answers.length > 1 ? answers : (answers[0] ?? "")];
      }),
    ),
  };
  try {
    const result = await updateRegistration(token, values);
    if (result.outcome === "updated") {
      refreshManagementPage(token);
      return { status: "success", message: "Your Registration was updated." };
    }
    if (result.outcome === "invalid_answers") {
      return {
        status: "error",
        message: "Review the highlighted answers and try again.",
        fieldErrors: result.fieldErrors,
        values: result.values,
      };
    }
    return {
      status: "error",
      message:
        result.outcome === "closed"
          ? "This Registration can no longer be edited."
          : "This management link is no longer valid.",
      values,
    };
  } catch {
    return {
      status: "error",
      message: "Your Registration could not be updated. Try again.",
      values,
    };
  }
}

export async function resendTicketAction(
  token: string,
  previousState: ManagementActionState,
): Promise<ManagementActionState> {
  void previousState;
  try {
    const result = await resendTicket(token);
    if (result.outcome === "sent" && result.deliveryStatus === "sent") {
      return { status: "success", message: "The existing Ticket was sent again." };
    }
    if (result.outcome === "sent") {
      return {
        status: "error",
        message: "The Ticket remains active, but the email could not be sent. Try again later.",
      };
    }
    return { status: "error", message: "This Ticket can no longer be resent." };
  } catch {
    return { status: "error", message: "The Ticket email could not be sent. Try again." };
  }
}

export async function replaceTicketAction(
  token: string,
  previousState: ManagementActionState,
): Promise<ManagementActionState> {
  void previousState;
  try {
    const result = await replaceTicket(token);
    if (result.outcome === "replaced") {
      refreshManagementPage(token);
      return {
        status: result.deliveryStatus === "failed" ? "error" : "success",
        message:
          result.deliveryStatus === "failed"
            ? "The old Ticket was invalidated and the replacement is shown here, but its email could not be sent."
            : "The old Ticket was invalidated and a replacement was issued and emailed.",
      };
    }
    return {
      status: "error",
      message:
        result.outcome === "closed"
          ? "Tickets cannot be replaced after check-in opens."
          : "This Ticket can no longer be replaced.",
    };
  } catch {
    return { status: "error", message: "The Ticket could not be replaced. Try again." };
  }
}

export async function cancelRegistrationAction(
  token: string,
  previousState: ManagementActionState,
): Promise<ManagementActionState> {
  void previousState;
  try {
    const result = await cancelRegistration(token);
    if (result.outcome === "canceled") {
      refreshManagementPage(token);
      return {
        status: "success",
        message: "Your Registration was canceled and this Ticket is no longer valid.",
      };
    }
    return {
      status: "error",
      message:
        result.outcome === "closed"
          ? "Registrations cannot be canceled after check-in opens."
          : "This Registration can no longer be canceled.",
    };
  } catch {
    return { status: "error", message: "The Registration could not be canceled. Try again." };
  }
}
