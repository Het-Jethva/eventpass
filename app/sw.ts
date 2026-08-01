/// <reference lib="webworker" />

import {
  CacheFirst,
  CacheableResponsePlugin,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
} from "serwist";
import type { PrecacheEntry, RouteMatchCallbackOptions, RuntimeCaching } from "serwist";

declare global {
  interface WorkerGlobalScope {
    __SW_MANIFEST: (string | PrecacheEntry)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const NETWORK_ONLY_METHODS = ["DELETE", "GET", "HEAD", "PATCH", "POST", "PUT"] as const;

const SAFE_PUBLIC_ASSETS = new Set([
  "/apple-touch-icon.png",
  "/favicon.ico",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-192.png",
  "/icon-maskable-512.png",
]);

const IMMUTABLE_ASSET_FILE = /\.(?:css|eot|gif|ico|jpe?g|js|png|svg|ttf|woff2?|webp)$/i;

// These are deliberately allowlisted. In particular, JSON, CSV, and arbitrary
// public paths do not become runtime-cacheable merely because they have a file
// extension.
const isImmutableStaticAsset = ({ sameOrigin, request, url }: RouteMatchCallbackOptions) =>
  sameOrigin &&
  request.method === "GET" &&
  ((url.pathname.startsWith("/_next/static/") && IMMUTABLE_ASSET_FILE.test(url.pathname)) ||
    SAFE_PUBLIC_ASSETS.has(url.pathname));

const isApiRequest = ({ url }: RouteMatchCallbackOptions) =>
  url.pathname === "/api" || url.pathname.startsWith("/api/");

const isDataResponseRequest = ({ sameOrigin, url }: RouteMatchCallbackOptions) =>
  sameOrigin && /\.(?:csv|json|xml)$/i.test(url.pathname);

const isScannerPath = (pathname: string) => pathname === "/scanner" || pathname.startsWith("/scanner/");

const isScannerShellRequest = ({ request, sameOrigin, url }: RouteMatchCallbackOptions) =>
  sameOrigin &&
  isScannerPath(url.pathname) &&
  (request.mode === "navigate" ||
    request.headers.get("RSC") === "1" ||
    request.headers.get("Next-Router-Prefetch") === "1");

const isNonScannerDocumentRequest = ({ request, sameOrigin, url }: RouteMatchCallbackOptions) =>
  sameOrigin &&
  !isScannerPath(url.pathname) &&
  (request.mode === "navigate" ||
    request.headers.get("RSC") === "1" ||
    request.headers.get("Next-Router-Prefetch") === "1" ||
    request.headers.get("Accept")?.includes("text/html") === true);

const networkOnlyRoutes = (matcher: RuntimeCaching["matcher"]): RuntimeCaching[] =>
  NETWORK_ONLY_METHODS.map((method) => ({
    matcher,
    method,
    handler: new NetworkOnly(),
  }));

const immutableAssetCache = new CacheFirst({
  cacheName: "eventpass-immutable-assets-v1",
  plugins: [
    new CacheableResponsePlugin({ statuses: [200] }),
    new ExpirationPlugin({
      maxEntries: 256,
      maxAgeSeconds: 365 * 24 * 60 * 60,
      purgeOnQuotaError: true,
    }),
  ],
});

const scannerShellCache = new NetworkFirst({
  cacheName: "eventpass-scanner-shell-v1",
  plugins: [
    new CacheableResponsePlugin({ statuses: [200] }),
    new ExpirationPlugin({
      maxEntries: 8,
      maxAgeSeconds: 30 * 24 * 60 * 60,
      maxAgeFrom: "last-used",
      purgeOnQuotaError: true,
    }),
  ],
});

// The old defaultCache routes used these names for broad runtime caches. Purge
// every known variant, including names prefixed or suffixed by an older scope,
// so authenticated responses cannot survive the policy change.
const LEGACY_BROAD_CACHE_NAMES = [
  "google-fonts-webfonts",
  "google-fonts-stylesheets",
  "static-font-assets",
  "static-image-assets",
  "next-static-js-assets",
  "next-image",
  "static-audio-assets",
  "static-video-assets",
  "static-js-assets",
  "static-style-assets",
  "next-data",
  "static-data-assets",
  "apis",
  "pages-rsc-prefetch",
  "pages-rsc",
  "pages",
  "others",
  "cross-origin",
  "runtime",
] as const;

const isLegacyBroadCacheName = (cacheName: string) =>
  LEGACY_BROAD_CACHE_NAMES.some(
    (legacyName) =>
      cacheName === legacyName ||
      cacheName === `serwist-${legacyName}` ||
      cacheName.startsWith(`${legacyName}-`) ||
      cacheName.startsWith(`serwist-${legacyName}-`) ||
      cacheName.endsWith(`-${legacyName}`),
  );

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // These routes come before every asset rule so data and authenticated
    // responses cannot be captured by a future broad matcher.
    ...networkOnlyRoutes(isApiRequest),
    ...networkOnlyRoutes(isDataResponseRequest),
    {
      matcher: isScannerShellRequest,
      handler: scannerShellCache,
    },
    {
      matcher: isNonScannerDocumentRequest,
      handler: new NetworkOnly(),
    },
    {
      matcher: isImmutableStaticAsset,
      handler: immutableAssetCache,
    },
  ],
});

// Any request that is not one of the deliberately safe routes above stays
// network-only as a defense-in-depth boundary.
for (const method of NETWORK_ONLY_METHODS) {
  serwist.setDefaultHandler(new NetworkOnly(), method);
}

self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter(isLegacyBroadCacheName)
          .map((cacheName) => caches.delete(cacheName)),
      ),
    ),
  );
});

self.addEventListener("message", (event: ExtendableMessageEvent) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});

serwist.addEventListeners();
