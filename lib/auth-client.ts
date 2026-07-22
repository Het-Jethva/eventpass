import { createAuthClient } from "better-auth/react";
import {
  inferAdditionalFields,
  magicLinkClient,
} from "better-auth/client/plugins";

import { normalizeStaffEmail } from "@/features/staff-identity/normalize-staff-email";
import type { auth } from "@/lib/auth";

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>(), magicLinkClient()],
});

export const staffIdentityClient = {
  async requestMagicLink(email: string, website: string) {
    const { error } = await authClient.signIn.magicLink({
      callbackURL: "/events",
      email: normalizeStaffEmail(email),
      errorCallbackURL: "/sign-in?error=invalid-link",
      fetchOptions: {
        body: { website },
      },
    });

    if (error) {
      throw error;
    }

  },
};
