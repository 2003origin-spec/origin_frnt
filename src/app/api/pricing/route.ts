/**
 * GET /api/pricing — public, cached student-facing pricing snapshot.
 *
 * The snapshot is display-only. Checkout resolves the amount again on the
 * server, so a stale CDN/Redis value can never change what a student is
 * charged. The payments flag deliberately gates this new purchase surface.
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { checkRateLimit, generalLimiter } from "@/lib/rate-limit";
import { getPublicPricing } from "@/server/pricing/pricing-service";
import { handleTeacherError } from "@/app/api/teacher/_utils";

function callerIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "anonymous"
  );
}

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("payments");
    const limited = await checkRateLimit(generalLimiter, `public-pricing:${callerIp(request)}`, {
      honorIncidentMode: false,
    });
    if (limited) return limited;

    const snapshot = await getPublicPricing();
    return Response.json(snapshot, {
      headers: {
        // Redis is the application cache; this prevents an intermediary from
        // serving an unexpectedly long-lived price after an admin invalidation.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleTeacherError(error);
  }
}
