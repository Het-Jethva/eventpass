import "server-only";

import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { sendStaffMagicLink } from "@/lib/email/send-staff-magic-link";

export const auth = betterAuth({
  appName: "EventPass",
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
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  verification: {
    storeIdentifier: "hashed",
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    customRules: {
      "/sign-in/magic-link": {
        window: 60,
        max: 3,
      },
    },
  },
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
              message: "This staff account is suspended.",
            });
          }

          return { data: newSession };
        },
      },
    },
  },
  plugins: [
    magicLink({
      expiresIn: 60 * 15,
      storeToken: "hashed",
      sendMagicLink: async ({ email, url }) => {
        await sendStaffMagicLink(email, url);
      },
    }),
    nextCookies(),
  ],
});
