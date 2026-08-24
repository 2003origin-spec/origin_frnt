/** GET | POST /api/internal/payments/reconcile — bounded payment lifecycle pass. */

import { NextResponse, type NextRequest } from "next/server";

import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireCronCaller } from "@/server/authz";
import { reconcilePayments } from "@/server/payments/reconciliation";

import { handleTeacherError } from "@/app/api/teacher/_utils";

export const dynamic = "force-dynamic";

async function handle(request: NextRequest) {
  try {
    if (!isFeatureEnabled("payments")) {
      return NextResponse.json({ detail: "Not found." }, { status: 404 });
    }
    await requireCronCaller(request);
    const rawLimit = Number(new URL(request.url).searchParams.get("limit") ?? "50");
    const result = await reconcilePayments({
      limit: Number.isFinite(rawLimit) ? Math.trunc(rawLimit) : 50,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export const GET = handle;
export const POST = handle;
