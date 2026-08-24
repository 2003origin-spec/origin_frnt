/**
 * GET | POST /api/internal/payments/health — payments configuration + backlog.
 *
 * The single place to answer "is the payment system actually wired up?" without
 * making a test payment. Reports:
 *   • which Razorpay mode is active and whether all THREE credentials resolved
 *     (key id, key secret, webhook secret) — and from which env names;
 *   • `modeMismatch`, the live-key-in-test-mode class of outage that otherwise
 *     shows up only as every webhook silently failing its HMAC;
 *   • the drain backlog and `lastWebhookAt`, which is how you notice that the
 *     webhook URL was never registered in the Razorpay dashboard.
 *
 * Never returns a secret or any part of one — only presence and provenance.
 *
 * The report itself lives in `payments/health-report.ts` because the admin
 * financials dashboard renders the same tiles from an admin session, and the
 * two must never drift (Phase 8).
 *
 * Auth: INTERNAL_CRON_TOKEN or Vercel's own CRON_SECRET (same as the drains).
 * GET is supported because Vercel Cron issues GET.
 *
 * Plan: V1/RAZORPAY_PAYMENTS_PLAN.md (D15, Phase 1).
 */

import { NextResponse, type NextRequest } from "next/server";

import { requireCronCaller } from "@/server/authz";
import { buildPaymentsHealth } from "@/server/payments/health-report";

import { handleTeacherError } from "@/app/api/teacher/_utils";

export const dynamic = "force-dynamic";

async function handle(request: NextRequest) {
  try {
    await requireCronCaller(request);
    // Always 200 — this is a diagnostic, and a non-200 would make an uptime probe
    // indistinguishable from an auth failure. Read `ok`.
    return NextResponse.json(await buildPaymentsHealth());
  } catch (error) {
    return handleTeacherError(error);
  }
}

export const GET = handle;
export const POST = handle;
