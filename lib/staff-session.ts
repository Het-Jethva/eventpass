import "server-only";

import { cache } from "react";
import { headers } from "next/headers";

import { createStaffIdentityService } from "@/features/staff-identity/staff-identity-service";
import { auth } from "@/lib/auth";

export const getActiveStaffSession = cache(async () => {
  const requestHeaders = await headers();
  const service = createStaffIdentityService({
    async requestMagicLink(request) {
      await auth.api.signInMagicLink({
        body: request,
        headers: requestHeaders,
      });
    },
    async getSession() {
      return auth.api.getSession({ headers: requestHeaders });
    },
    async revokeCurrentSession() {
      await auth.api.signOut({ headers: requestHeaders });
    },
  });

  return service.getActiveSession();
});

export async function signOutCurrentStaff() {
  const requestHeaders = await headers();
  const service = createStaffIdentityService({
    async requestMagicLink(request) {
      await auth.api.signInMagicLink({
        body: request,
        headers: requestHeaders,
      });
    },
    async getSession() {
      return auth.api.getSession({ headers: requestHeaders });
    },
    async revokeCurrentSession() {
      await auth.api.signOut({ headers: requestHeaders });
    },
  });

  await service.signOut();
}
