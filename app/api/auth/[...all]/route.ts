import { toNextJsHandler } from "better-auth/next-js";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";

const handler = toNextJsHandler(auth);

export const GET = handler.GET;

export async function POST(request: NextRequest) {
  if (!request.nextUrl.pathname.endsWith("/sign-in/magic-link")) {
    return handler.POST(request);
  }

  const body: unknown = await request.clone().json().catch(() => null);

  if (!body) {
    return handler.POST(request);
  }
  const normalizedBody =
    body && typeof body === "object" && "email" in body
      ? {
          ...body,
          email:
            typeof body.email === "string"
              ? body.email.trim().toLowerCase()
              : body.email,
        }
      : body;
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
