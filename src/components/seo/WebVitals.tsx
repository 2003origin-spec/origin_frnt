"use client";

import { useReportWebVitals } from "next/web-vitals";

import { track } from "@/lib/analytics";

/**
 * Reports Core Web Vitals (LCP, CLS, INP, FCP, TTFB) into GA4 as `web_vitals`
 * events. Core Web Vitals are a Google ranking signal; this also lets us watch
 * real-user performance in GA without any paid add-on.
 */
export function WebVitals() {
  useReportWebVitals((metric) => {
    track("web_vitals", {
      metric_name: metric.name,
      // CLS is unitless (×1000 for integer reporting); others are ms.
      value: Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value),
      metric_id: metric.id,
      metric_rating: metric.rating ?? "",
    });
  });
  return null;
}
