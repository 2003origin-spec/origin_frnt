import { unstable_rethrow } from "next/navigation";

import { buildLlmsTxt } from "@/lib/seo/llms-txt";
import { getCanonicalSiteUrl } from "@/lib/site-url";
import { isFeatureEnabledRuntime } from "@/server/feature-flags-runtime";

// /llms.txt (public in route-policy). Built per request so the Rank Predictor
// and college finder parts follow their flags and kill switch, like the
// sitemap. A failed flag read leaves those parts out; the file always answers.
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  let predictor = false;
  let colleges = false;
  try {
    [predictor, colleges] = await Promise.all([isFeatureEnabledRuntime("rankPredictor"), isFeatureEnabledRuntime("collegeCounselling")]);
  } catch (err) {
    unstable_rethrow(err); // Next.js control flow, not a failure
  }
  return new Response(buildLlmsTxt(getCanonicalSiteUrl(), { predictor, colleges }), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      // Bots fetch it rarely; a kill switch shows up here within 5 minutes.
      "cache-control": "public, max-age=300, s-maxage=300",
    },
  });
}
