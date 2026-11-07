import "server-only";

import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getConfiguredApplicationUrl } from "@/lib/application-url";
import { sendStaffMagicLink } from "@/lib/email/send-staff-magic-link";

const MAGIC_LINK_SECONDS = 60 * 15;

export const auth = betterAuth({
  appName: "EventPass",
  baseURL: getConfiguredApplicationUrl(),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  user: {
    additionalFields: {
      suspended: {
        type: "boolean",
        required: true,
        defaultValue: false,
        input: false,
      },
      isPlatformAdmin: {
        type: "boolean",
        required: true,
        defaultValue: false,
        input: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  verification: {
    storeIdentifier: "hashed",
  },
  rateLimit: { enabled: false },
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (newSession) => {
          const [staffUser] = await db
            .select({ suspended: schema.user.suspended })
            .from(schema.user)
            .where(eq(schema.user.id, newSession.userId))
            .limit(1);

          if (staffUser?.suspended) {
            throw new APIError("FORBIDDEN", {
              message: "This staff user is suspended.",
            });
          }

          return { data: newSession };
        },
      },
    },
  },
  plugins: [
    magicLink({
      expiresIn: MAGIC_LINK_SECONDS,
      storeToken: "hashed",
      sendMagicLink: ({ email, url }) => sendStaffMagicLink(email, url),
    }),
    nextCookies(),
  ],
});
