import { NextResponse, type NextRequest } from "next/server";
import { requireInternal } from "@/server/authz";
import { readRequiredServiceToken } from "@/server/service-auth";

/**
 * POST /api/internal/cron/prerequisites-refresh
 *
 * Proxy for Vercel Cron to trigger the Patent A Prerequisite Graph Refresh
 * job on the origin-ai GCP service.
 * Authenticated by INTERNAL_CRON_TOKEN.
 */
export async function POST(request: NextRequest) {
  try {
    await requireInternal(request);
    
    const serviceUrl = process.env.ORIGIN_AI_SERVICE_URL?.trim();
    if (!serviceUrl) {
      throw new Error("ORIGIN_AI_SERVICE_URL is not configured.");
    }
    
    const token = readRequiredServiceToken("ORIGIN_AI_SERVICE_TOKEN");
    
    const response = await fetch(`${serviceUrl}/api/v1/internal/prerequisites/refresh`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: "Upstream origin-ai service failed", details: text },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}