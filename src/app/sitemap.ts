import type { MetadataRoute } from "next";
import { unstable_rethrow } from "next/navigation";

import { COLLEGE_FINDER_PATH, EXAM_PAGE_LIST, RANK_PREDICTOR_PATH } from "@/lib/seo/rank-predictor-seo";
import { getCanonicalSiteUrl } from "@/lib/site-url";
import { isFeatureEnabledRuntime } from "@/server/feature-flags-runtime";

// Read per request: the Rank Predictor entry follows the runtime flag (and its
// kill switch), so it must not be baked in at build time.
export const dynamic = "force-dynamic";

/**
 * /sitemap.xml — the public, indexable pages only. App/auth pages are omitted
 * here AND disallowed in robots.ts. Keep this list in sync with the public
 * pages in route-policy's PUBLIC_APP_PATHS.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getCanonicalSiteUrl();

  const entries: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
    { path: "/", priority: 1.0, changeFrequency: "daily" },
    { path: "/premium", priority: 0.8, changeFrequency: "weekly" },
    { path: "/founders", priority: 0.6, changeFrequency: "monthly" },
    { path: "/faq", priority: 0.6, changeFrequency: "monthly" },
    { path: "/terms-and-conditions", priority: 0.3, changeFrequency: "yearly" },
    { path: "/privacy-policy", priority: 0.3, changeFrequency: "yearly" },
    { path: "/childrens-policy", priority: 0.3, changeFrequency: "yearly" },
    { path: "/refund-policy", priority: 0.3, changeFrequency: "yearly" },
    { path: "/return-policy", priority: 0.3, changeFrequency: "yearly" },
    { path: "/shipping-policy", priority: 0.3, changeFrequency: "yearly" },
  ];
  // Public Rank Predictor (plan §9.1) and its exam pages: listed only while the
  // flag is on. The college finder's public page only while BOTH flags are on.
  // A failed flag read leaves the entries out; it must never break the sitemap.
  try {
    const [predictor, counselling] = await Promise.all([
      isFeatureEnabledRuntime("rankPredictor"),
      isFeatureEnabledRuntime("collegeCounselling"),
    ]);
    if (predictor) {
      entries.push({ path: RANK_PREDICTOR_PATH, priority: 0.9, changeFrequency: "weekly" });
      for (const page of EXAM_PAGE_LIST) entries.push({ path: page.path, priority: 0.8, changeFrequency: "weekly" });
      if (counselling) entries.push({ path: COLLEGE_FINDER_PATH, priority: 0.8, changeFrequency: "weekly" });
    }
  } catch (err) {
    unstable_rethrow(err); // Next.js control flow, not a failure
  }

  return entries.map((e) => ({
    url: `${siteUrl}${e.path === "/" ? "" : e.path}`,
    changeFrequency: e.changeFrequency,
    priority: e.priority,
  }));
}
