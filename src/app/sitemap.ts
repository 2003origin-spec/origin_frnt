import type { MetadataRoute } from "next";

import { getCanonicalSiteUrl } from "@/lib/site-url";

/**
 * /sitemap.xml — the public, indexable pages only. App/auth pages are omitted
 * here AND disallowed in robots.ts. Keep this list in sync with the public
 * pages in route-policy's PUBLIC_APP_PATHS.
 */
export default function sitemap(): MetadataRoute.Sitemap {
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

  return entries.map((e) => ({
    url: `${siteUrl}${e.path === "/" ? "" : e.path}`,
    changeFrequency: e.changeFrequency,
    priority: e.priority,
  }));
}
