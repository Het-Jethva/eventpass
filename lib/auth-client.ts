import { createAuthClient } from "better-auth/react";
import {
  inferAdditionalFields,
  magicLinkClient,
} from "better-auth/client/plugins";

import { createStaffIdentityService } from "@/features/staff-identity/staff-identity-service";
import type { auth } from "@/lib/auth";

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>(), magicLinkClient()],
});

export const staffIdentityClient = createStaffIdentityService({
  async requestMagicLink(request) {
    const { error } = await authClient.signIn.magicLink(request);

    if (error) {
      throw error;
    }
  },
  async getSession() {
    const { data } = await authClient.getSession();
    return data;
  },
  async revokeCurrentSession() {
    const { error } = await authClient.signOut();

    if (error) {
      throw error;
    }
  },
});
