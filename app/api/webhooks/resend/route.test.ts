import { afterEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/webhooks/resend/route";

describe("Resend webhook route", () => {
  const previousSecret = process.env.RESEND_WEBHOOK_SECRET;

  afterEach(() => {
    if (previousSecret === undefined) {
      delete process.env.RESEND_WEBHOOK_SECRET;
    } else {
      process.env.RESEND_WEBHOOK_SECRET = previousSecret;
    }
  });

  it("returns 503 when the webhook secret is unset", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    const response = await POST(new Request("http://localhost/api/webhooks/resend", { method: "POST" }));
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("Webhook is not configured.");
  });
});
