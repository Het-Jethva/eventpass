import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

// Bearer capabilities travel in URL paths (/tickets/[token], /offers/[token],
// /staff-invitations/[token]), so the browser must not hand the path to other
// origins in a Referer. Every external link already carries rel="noreferrer";
// the policy makes that true for anything that forgets to.
//
// A full Content-Security-Policy is deliberately not set: the theme bootstrap
// in app/layout.tsx and Next's own hydration scripts are inline, and a
// nonce-based policy is a separate piece of work. frame-ancestors carries no
// inline-script cost and closes clickjacking on the scanner and sign-in
// surfaces on its own. HSTS is left to the hosting platform, which sets it.
const SECURITY_HEADERS = [
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // The volunteer scanner needs the camera; nothing needs the rest.
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=()",
  },
];

// Last matching source wins for a given header (Next.js header overriding).
// Put these after `/:path*` so they actually replace the site-wide
// Referrer-Policy. Page metadata `referrer: "no-referrer"` does not, because
// a response header already set by `/:path*` wins over `<meta name="referrer">`.
const CAPABILITY_ROUTE_HEADERS = [
  ...SECURITY_HEADERS.filter((header) => header.key !== "Referrer-Policy"),
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Cache-Control", value: "private, no-store" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

// React's <ViewTransition> needs no configuration as of Next 16.3 — the App
// Router builds against a React canary that exports it. It degrades cleanly:
// without browser support the app works normally and simply does not animate.
const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      { source: "/tickets/:path*", headers: CAPABILITY_ROUTE_HEADERS },
      { source: "/offers/:path*", headers: CAPABILITY_ROUTE_HEADERS },
      { source: "/staff-invitations/:path*", headers: CAPABILITY_ROUTE_HEADERS },
      { source: "/e/:slug/verify", headers: CAPABILITY_ROUTE_HEADERS },
      { source: "/sign-in", headers: CAPABILITY_ROUTE_HEADERS },
    ];
  },
};

export default withSerwist(nextConfig);
