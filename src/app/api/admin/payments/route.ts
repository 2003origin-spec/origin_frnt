/**
 * GET /api/admin/payments — the money-ledger browser, and its CSV export.
 *
 * `?format=csv` returns the same filtered result set as an attachment (up to
 * `LEDGER_CSV_LIMIT` rows) rather than a JSON page, so an admin can reconcile
 * against a Razorpay settlement file in a spreadsheet.
 *
 * Like the summary route this is NOT gated on the `payments` feature flag: the
 * flag stops students checking out, it does not stop an admin reading the money
 * that was already taken.
 *
 * Auth: admin session (enforced here and by the /api/admin route policy).
 *
 * Plan: V1/RAZORPAY_PAYMENTS_PLAN.md §8 Phase 8.
 */

import type { NextRequest } from "next/server";

import { ALL_SUBJECTS } from "@/lib/entitlements";
import { requireRole } from "@/server/authz";
import { resolveRange } from "@/server/payments/financials";
import {
  clampLimit,
  LEDGER_CSV_LIMIT,
  LEDGER_KINDS,
  LEDGER_STATUSES,
  ledgerToCsv,
  listLedger,
  pickEnum,
  type LedgerFilters,
} from "@/server/payments/ledger-query";
import { isLivemode } from "@/server/payments/razorpay-client";
import { isUserPostgresConfigured } from "@/server/user-postgres";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

export const dynamic = "force-dynamic";

function resolveLivemode(raw: string | null): boolean {
  const value = raw?.trim().toLowerCase();
  if (value === "1" || value === "true" || value === "live") return true;
  if (value === "0" || value === "false" || value === "test") return false;
  return isLivemode();
}

/** Repeated (`?status=a&status=b`) and comma-joined (`?status=a,b`) both work. */
function multi(params: URLSearchParams, name: string): string[] {
  return params
    .getAll(name)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, ["admin"]);
    const params = request.nextUrl.searchParams;
    const csv = params.get("format")?.trim().toLowerCase() === "csv";

    let fromIso: string | null = null;
    let toIso: string | null = null;
    if (params.get("from") || params.get("to") || params.get("days")) {
      try {
        const range = resolveRange({
          from: params.get("from"),
          to: params.get("to"),
          days: params.get("days") ? Number(params.get("days")) : null,
        });
        fromIso = range.fromIso;
        toIso = range.toIso;
      } catch (error) {
        return teacherJson(
          { detail: error instanceof Error ? error.message : "Invalid reporting window." },
          { status: 400 },
        );
      }
    }

    const subjectRaw = params.get("subject")?.trim().toLowerCase() || null;
    const subject = subjectRaw && (ALL_SUBJECTS as readonly string[]).includes(subjectRaw)
      ? subjectRaw
      : null;
    if (subjectRaw && !subject) {
      return teacherJson({ detail: "Unknown subject filter." }, { status: 400 });
    }

    const filters: LedgerFilters = {
      livemode: resolveLivemode(params.get("livemode")),
      statuses: pickEnum(multi(params, "status"), LEDGER_STATUSES),
      kinds: pickEnum(multi(params, "kind"), LEDGER_KINDS),
      subject,
      couponCode: params.get("coupon")?.trim() || null,
      userId: params.get("userId")?.trim() || null,
      search: params.get("q")?.trim().slice(0, 200) || null,
      fromIso,
      toIso,
      limit: csv ? LEDGER_CSV_LIMIT : clampLimit(params.get("limit")),
      offset: Math.max(0, Math.floor(Number(params.get("offset")) || 0)),
    };

    if (!isUserPostgresConfigured()) {
      return teacherJson({ detail: "USER_DATABASE_URL is not configured." }, { status: 503 });
    }

    const page = await listLedger(filters);
    if (!csv) return teacherJson(page, { status: 200 });

    const mode = filters.livemode ? "live" : "test";
    const stamp = new Date().toISOString().slice(0, 10);
    // The BOM is deliberate: without it Excel on Windows renders a UTF-8 rupee
    // sign or a non-Latin buyer name as mojibake. It is added here rather than in
    // ledgerToCsv so the pure serialiser stays byte-exact for tests.
    return new Response(`\uFEFF${ledgerToCsv(page.rows)}`, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="origin-payments-${mode}-${stamp}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return handleTeacherError(error);
  }
}
