/**
 * POST /api/cbt-student/report — unlock a participant report card.
 *        body: { slug, studentCode }  → { report } + cbt_report cookie
 * GET  /api/cbt-student/report — re-read the report using that cookie.
 *
 * Both verbs live on this ONE file rather than separate child routes (see the
 * Next-16 phantom-404 incident). It rides the already-public
 * `/api/cbt-student` prefix, so it is public at the edge and CSRF-exempt by
 * policy — exactly like join/resume — and gated entirely in-handler.
 *
 * The gate lives in cbt-report-service: platform flag → teacher's premium
 * add-on → room publish switch → room finished → attempt finished and graded.
 * Everything that fails collapses to the same 404 so the endpoint cannot be
 * used to enumerate rooms, teachers or codes.
 */

import type { NextRequest, NextResponse } from "next/server";

import { cbtReportFailureLimiter, cbtReportUnlockLimiter, checkRateLimit } from "@/lib/rate-limit";
import { CBT_REPORT_COOKIE, CBT_REPORT_COOKIE_OPTS, signReportToken, verifyReportToken } from "@/lib/cbt/report-token";
import {
  assertReportStillPublished,
  getCbtReportCard,
  resolveReportByStudentCode,
  type CbtReportDenial,
} from "@/server/cbt/cbt-report-service";

import {
  cbtEnabled,
  clientIpOf,
  handleStudentError,
  notFoundWhenDisabled,
  requireJsonContentType,
  studentJson,
} from "../_utils";

/** Deliberately vague on anything that could confirm a room or a code exists. */
const DENIAL_RESPONSE: Record<CbtReportDenial, { status: number; detail: string }> = {
  not_found: { status: 404, detail: "This report link isn't available." },
  unknown_code: { status: 400, detail: "We couldn't find that CBT ID for this test." },
  not_finished: { status: 409, detail: "Your test hasn't been submitted yet." },
  not_graded: {
    status: 409,
    detail: "There's no report for this ID — the paper was never attempted.",
  },
};

export async function POST(request: NextRequest) {
  if (!cbtEnabled()) return notFoundWhenDisabled();
  try {
    if (!requireJsonContentType(request)) {
      return studentJson({ detail: "Invalid content type." }, { status: 415 });
    }
    const body = (await request.json().catch(() => ({}))) as { slug?: string; studentCode?: string };
    if (!body.slug || !body.studentCode) {
      return studentJson({ detail: "Your CBT ID is required." }, { status: 400 });
    }

    const ipKey = `${clientIpOf(request)}:${body.slug}`;
    const limited = await checkRateLimit(cbtReportUnlockLimiter, ipKey);
    if (limited) return limited as unknown as NextResponse;

    const resolved = await resolveReportByStudentCode(body.slug, body.studentCode);
    if (!resolved.ok) {
      // Only a WRONG CODE burns the failure budget. "Not finished yet" is an
      // honest student refreshing, and locking them out would be hostile.
      if (resolved.reason === "unknown_code") {
        const failed = await checkRateLimit(cbtReportFailureLimiter, ipKey);
        if (failed) return failed as unknown as NextResponse;
      }
      const denial = DENIAL_RESPONSE[resolved.reason];
      return studentJson({ detail: denial.detail, code: resolved.reason }, { status: denial.status });
    }

    const report = await getCbtReportCard(resolved.target);
    if (!report) return studentJson(DENIAL_RESPONSE.not_found, { status: 404 });

    const token = await signReportToken({
      room_id: resolved.target.roomId,
      participant_id: resolved.target.participantId,
    });
    const res = studentJson({ report });
    res.cookies.set(CBT_REPORT_COOKIE, token, CBT_REPORT_COOKIE_OPTS);
    return res;
  } catch (error) {
    return handleStudentError(error);
  }
}

export async function GET(request: NextRequest) {
  if (!cbtEnabled()) return notFoundWhenDisabled();
  try {
    const claims = await verifyReportToken(request.cookies.get(CBT_REPORT_COOKIE)?.value);
    if (!claims) return studentJson({ detail: "Enter your CBT ID to view your report." }, { status: 401 });

    // The token is short-lived but the entitlement can be revoked at any moment,
    // so the whole gate is re-checked rather than trusted from issue time.
    if (!(await assertReportStillPublished(claims.room_id))) {
      const res = studentJson(DENIAL_RESPONSE.not_found, { status: 404 });
      res.cookies.delete(CBT_REPORT_COOKIE);
      return res;
    }

    const report = await getCbtReportCard({
      roomId: claims.room_id,
      participantId: claims.participant_id,
    });
    if (!report) return studentJson(DENIAL_RESPONSE.not_found, { status: 404 });
    return studentJson({ report });
  } catch (error) {
    return handleStudentError(error);
  }
}
