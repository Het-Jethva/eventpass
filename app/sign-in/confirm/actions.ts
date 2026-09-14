"use server";

import { redirect } from "next/navigation";

import { staffMagicLinkConsumePath } from "@/features/staff-identity/magic-link-policy";

function safeCallback(raw: string | undefined) {
  return raw?.startsWith("/") && !raw.startsWith("//") ? raw : "/events";
}

export async function confirmStaffMagicLinkAction(
  token: string,
  callbackURL: string,
) {
  if (!token) {
    redirect("/sign-in?error=invalid-link");
  }
  redirect(
    staffMagicLinkConsumePath(
      token,
      safeCallback(callbackURL),
      "/sign-in?error=invalid-link",
    ),
  );
}
