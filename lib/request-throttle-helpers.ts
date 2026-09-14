import { createHmac } from "node:crypto";

export function throttleDigest(value: string) {
  // Dedicated secret keeps throttle hashes independent from session signing.
  // Falls back to the auth secret so existing deployments keep working.
  const secret = process.env.THROTTLE_SECRET ?? process.env.BETTER_AUTH_SECRET;

  if (!secret) {
    throw new Error("THROTTLE_SECRET or BETTER_AUTH_SECRET is required for request throttling.");
  }

  return createHmac("sha256", secret).update(value).digest("hex");
}

// Trusts the first forwarded address. Deployments must strip or overwrite
// these headers at the edge proxy, otherwise clients can spoof the IP used
// for rate limiting.
export function requestIp(headers: Headers) {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}
