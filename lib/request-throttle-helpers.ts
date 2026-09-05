import { createHmac } from "node:crypto";

export function throttleDigest(value: string) {
  const secret = process.env.BETTER_AUTH_SECRET;

  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is required for request throttling.");
  }

  return createHmac("sha256", secret).update(value).digest("hex");
}

export function requestIp(headers: Headers) {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}
