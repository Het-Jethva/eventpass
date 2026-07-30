import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  experimental: {
    // Enables React's <ViewTransition> during route navigation. Still flagged
    // experimental in Next 16, but it degrades cleanly: without browser support
    // the app works normally and simply does not animate.
    //
    // Next aliases `react` to its bundled react-experimental build when this is
    // on, which is where ViewTransition actually lives — stable react 19.2 does
    // not export it. Hence types/react-view-transition.d.ts.
    viewTransition: true,
  },
};

export default withSerwist(nextConfig);
