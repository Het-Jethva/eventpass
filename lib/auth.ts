import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {
  sendStaffMagicLink,
  StaffMagicLinkDeliveryError,
} from "@/lib/email/send-staff-magic-link";

const MAGIC_LINK_SECONDS = 60 * 15;
const MAX_MAGIC_LINK_DELIVERIES = 3;

function hashMagicLinkToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

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
      sendMagicLink: async ({ email, token, url }, context) => {
        let currentToken = token;
        let currentUrl = url;

        for (let attempt = 1; attempt <= MAX_MAGIC_LINK_DELIVERIES; attempt += 1) {
          try {
            await sendStaffMagicLink(email, currentUrl);
            return;
          } catch (error) {
            if (
              !(error instanceof StaffMagicLinkDeliveryError) ||
              !error.retryable ||
              !context ||
              attempt === MAX_MAGIC_LINK_DELIVERIES
            ) {
              throw error;
            }

            const identifier = hashMagicLinkToken(currentToken);
            const verification =
              await context.context.internalAdapter.findVerificationValue(identifier);

            if (!verification) {
              throw error;
            }

            await context.context.internalAdapter.deleteVerificationByIdentifier(identifier);
            currentToken = randomBytes(32).toString("base64url");
            await context.context.internalAdapter.createVerificationValue({
              expiresAt: new Date(Date.now() + MAGIC_LINK_SECONDS * 1_000),
              identifier: hashMagicLinkToken(currentToken),
              value: verification.value,
            });
            const nextUrl = new URL(currentUrl);
            nextUrl.searchParams.set("token", currentToken);
            currentUrl = nextUrl.toString();
          }
        }
      },
    }),
    nextCookies(),
  ],
});
