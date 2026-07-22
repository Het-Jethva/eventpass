import "server-only";

import { cache } from "react";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";

export const getActiveStaffSession = cache(async () => {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session || !session.user.suspended) {
    return session;
  }

  await auth.api.signOut({ headers: requestHeaders });
  return null;
});

export async function signOutCurrentStaff() {
  const requestHeaders = await headers();
  await auth.api.signOut({ headers: requestHeaders });
}
