import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

// React's <ViewTransition> needs no configuration as of Next 16.3 — the App
// Router builds against a React canary that exports it. It degrades cleanly:
// without browser support the app works normally and simply does not animate.
const nextConfig: NextConfig = {};

export default withSerwist(nextConfig);
