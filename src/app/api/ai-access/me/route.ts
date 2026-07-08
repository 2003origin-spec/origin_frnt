/**
 * AI Feature Toggle epic — student poll endpoint.
 *
 * Returns the caller's effective AI access as two booleans so the client can
 * hide/show the AI surfaces. JWT verify + in-process snapshot + ≤1 Redis GET;
 * no DB in steady state. Non-students get {false,false} with 200 (they don't
 * poll anyway); unauthenticated requests never reach here (edge policy:
 * /api/ai-access is an authenticated prefix — see src/server/route-policy.ts).
 *
 * Design: V1/ai-feature-toggle/04-server-enforcement-and-apis.md §3.
 */

import { type NextRequest, NextResponse } from "next/server";

import { resolveAiAccessForRequest } from "@/server/ai-access";

export async function GET(request: NextRequest) {
  const decision = await resolveAiAccessForRequest(request);
  return NextResponse.json(
    { originAi: decision.originAi, aiExplainer: decision.aiExplainer },
    { headers: { "Cache-Control": "no-store" } },
  );
}
