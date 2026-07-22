import { toNextJsHandler } from "better-auth/next-js";
import type { NextRequest } from "next/server";

import { normalizeStaffEmail } from "@/features/staff-identity/normalize-staff-email";
import { auth } from "@/lib/auth";
import {
  isMagicLinkRequestLimited,
  isMagicLinkVerificationLimited,
} from "@/lib/auth-request-throttle";

const handler = toNextJsHandler(auth);

export async function GET(request: NextRequest) {
  if (!request.nextUrl.pathname.endsWith("/magic-link/verify")) {
    return handler.GET(request);
  }

  const token = request.nextUrl.searchParams.get("token") ?? "missing";

  if (await isMagicLinkVerificationLimited(token, request.headers)) {
    return Response.redirect(new URL("/sign-in?error=rate-limited", request.url));
  }

  return handler.GET(request);
}

export async function POST(request: NextRequest) {
  if (!request.nextUrl.pathname.endsWith("/sign-in/magic-link")) {
    return handler.POST(request);
  }

  const body: unknown = await request.clone().json().catch(() => null);

  if (!body) {
    return handler.POST(request);
  }
  if (typeof body !== "object" || !("email" in body) || typeof body.email !== "string") {
    return handler.POST(request);
  }

  if ("website" in body && typeof body.website === "string" && body.website) {
    return Response.json({ status: true });
  }

  const normalizedEmail = normalizeStaffEmail(body.email);
  const normalizedBody: Record<string, unknown> = {
    ...body,
    email: normalizedEmail,
  };
  delete normalizedBody.website;

  if (await isMagicLinkRequestLimited(normalizedEmail, request.headers)) {
    return Response.json(
      { code: "TOO_MANY_REQUESTS", message: "Too many sign-in attempts." },
      { status: 429 },
    );
  }
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
