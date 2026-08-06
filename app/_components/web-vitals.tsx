"use client";

import { useReportWebVitals } from "next/web-vitals";

type ReportWebVitalsCallback = Parameters<typeof useReportWebVitals>[0];

const reportWebVitals: ReportWebVitalsCallback = (metric) => {
  if (process.env.NODE_ENV !== "production") return;

  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    navigationType: metric.navigationType,
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon(
      "/api/performance",
      new Blob([body], { type: "application/json" }),
    );
    return;
  }

  void fetch("/api/performance", {
    method: "POST",
    body,
    headers: { "content-type": "application/json" },
    keepalive: true,
  });
};

function WebVitals() {
  useReportWebVitals(reportWebVitals);
  return null;
}

export { WebVitals };
