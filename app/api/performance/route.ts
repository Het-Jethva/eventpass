const METRIC_NAMES = new Set(["TTFB", "FCP", "LCP", "FID", "CLS", "INP"]);
const RATINGS = new Set(["good", "needs-improvement", "poor"]);
const NAVIGATION_TYPES = new Set([
  "navigate",
  "reload",
  "prerender",
  "back-forward",
  "back-forward-cache",
  "restore",
]);

type PerformanceMetric = {
  name: string;
  value: number;
  rating: string;
  navigationType: string;
};

function isPerformanceMetric(value: unknown): value is PerformanceMetric {
  if (!value || typeof value !== "object") return false;
  const metric = value as Record<string, unknown>;

  return (
    typeof metric.name === "string" &&
    METRIC_NAMES.has(metric.name) &&
    typeof metric.value === "number" &&
    Number.isFinite(metric.value) &&
    metric.value >= 0 &&
    typeof metric.rating === "string" &&
    RATINGS.has(metric.rating) &&
    typeof metric.navigationType === "string" &&
    NAVIGATION_TYPES.has(metric.navigationType)
  );
}

export async function POST(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return new Response(null, { status: 403 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 1_024) {
    return new Response(null, { status: 413 });
  }

  let metric: unknown;
  try {
    metric = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  if (!isPerformanceMetric(metric)) {
    return new Response(null, { status: 400 });
  }

  // Deliberately excludes paths, user/session IDs, Event IDs, and page content.
  // Production logs can aggregate these fields into percentile dashboards.
  console.info("eventpass.performance", {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    navigationType: metric.navigationType,
  });

  return new Response(null, { status: 204 });
}
