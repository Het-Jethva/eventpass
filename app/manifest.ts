import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EventPass",
    short_name: "EventPass",
    description:
      "Trustworthy offline-first Event registration and admission operations.",
    start_url: "/events",
    display: "standalone",
    // These were both #09090b, so the install splash was always dark even for a
    // viewer whose system — and therefore the app — is light. A manifest cannot
    // vary by colour scheme, so it takes the light surface, and the per-theme
    // browser chrome is handled by the media-scoped theme-color in layout.tsx.
    background_color: "#fdfdfe",
    theme_color: "#fdfdfe",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
