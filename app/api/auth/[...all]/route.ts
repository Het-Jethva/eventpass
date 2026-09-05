import { toNextJsHandler } from "better-auth/next-js";
import type { NextRequest } from "next/server";

import { isEligibleStaffMagicLinkRecipient } from "@/features/staff-identity/server/staff-magic-link-eligibility";
import {
  isStaffMagicLinkRequestPath,
  isStaffMagicLinkVerifyPath,
} from "@/features/staff-identity/magic-link-policy";
import { normalizeStaffEmail } from "@/features/staff-identity/normalize-staff-email";
import { getConfiguredApplicationOrigin } from "@/lib/application-url";
import { auth } from "@/lib/auth";
import {
  isMagicLinkRequestLimited,
  isMagicLinkVerificationLimited,
} from "@/lib/auth-request-throttle";

const handler = toNextJsHandler(auth);

function configuredSignInUrl(search: string) {
  return new URL(search, `${getConfiguredApplicationOrigin()}/`);
}

export async function GET(request: NextRequest) {
  if (!isStaffMagicLinkVerifyPath(request.nextUrl.pathname)) {
    return handler.GET(request);
  }

  const token = request.nextUrl.searchParams.get("token") ?? "missing";

  if (await isMagicLinkVerificationLimited(token, request.headers)) {
    return Response.redirect(configuredSignInUrl("/sign-in?error=rate-limited"));
  }

  return handler.GET(request);
}

export async function POST(request: NextRequest) {
  if (!isStaffMagicLinkRequestPath(request.nextUrl.pathname)) {
    return handler.POST(request);
  }

  const body: unknown = await request.clone().json().catch(() => null);
  const email =
    body &&
    typeof body === "object" &&
    "email" in body &&
    typeof body.email === "string"
      ? body.email
      : "";

  if (
    body &&
    typeof body === "object" &&
    "website" in body &&
    typeof body.website === "string" &&
    body.website
  ) {
    return Response.json({ status: true });
  }

  const normalizedEmail = normalizeStaffEmail(email);
  if (await isMagicLinkRequestLimited(normalizedEmail, request.headers)) {
    return Response.json(
      { code: "TOO_MANY_REQUESTS", message: "Too many sign-in attempts." },
      { status: 429 },
    );
  }

  if (
    !normalizedEmail ||
    !(await isEligibleStaffMagicLinkRecipient(normalizedEmail))
  ) {
    return Response.json({ status: true });
  }

  const normalizedBody: Record<string, unknown> = {
    ...(typeof body === "object" && body !== null ? body : {}),
    email: normalizedEmail,
  };
  delete normalizedBody.website;

  const normalizedHeaders = new Headers(request.headers);
  normalizedHeaders.delete("content-length");

  return handler.POST(
    new Request(request.url, {
      body: JSON.stringify(normalizedBody),
      headers: normalizedHeaders,
      method: "POST",
    }),
  );
}
