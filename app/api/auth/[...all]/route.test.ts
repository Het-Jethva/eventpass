import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("staff magic-link verify GET", () => {
  it("redirects a verify request with no token to an invalid-link sign-in", async () => {
    const response = await GET(
      new NextRequest("http://localhost:3000/api/auth/magic-link/verify"),
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/sign-in?error=invalid-link",
    );
  });

  it("redirects a verify request without ep_confirm to the confirm page", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost:3000/api/auth/magic-link/verify?token=tok&callbackURL=/events",
      ),
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/sign-in/confirm?token=tok&callbackURL=%2Fevents",
    );
  });
});
