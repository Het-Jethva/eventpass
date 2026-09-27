"use server";

import { redirect } from "next/navigation";

import { signOutCurrentStaff } from "@/lib/staff-session";

export async function signOutAction() {
  await signOutCurrentStaff();
  redirect("/sign-in");
}
