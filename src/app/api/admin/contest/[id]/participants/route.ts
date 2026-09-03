/**
 * GET /api/admin/contest/[id]/participants
 *   ?search=&attemptState=&registrationStatus=&flagged=1&ineligible=1&premium=1
 *   &autoSubmitted=1&sort=&limit=&offset=&reveal=1
 *   → { summary, rows, total }
 *   ?format=csv → CSV download of the filtered page set
 *   ?userId=… → one participant's question-by-question answers + proctor snapshots
 *
 * Admin-only + `contest` flag. Rows carry student PII (most Origin students are
 * minors), so every read is audit-logged, mobile numbers are masked unless
 * `reveal=1` is passed, and CSV exports are logged distinctly.
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import {
  getParticipantAnswers,
  getParticipantSnapshots,
  getParticipantsSummary,
  listContestParticipants,
  type AttemptState,
} from "@/server/contest/contest-participants-service";
import {
  promoteParticipant,
  setParticipantEligibility,
  unregisterParticipant,
} from "@/server/contest/contest-participant-actions-service";
import { clearFlaggedAttempt, upholdFlaggedAttempt } from "@/server/contest/contest-review-service";
import { createPresignedR2PutUrl } from "@/server/media-storage";
import { recordAuditEvent } from "@/server/workspaces/audit";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireRole(request, ["admin"]);
    const { id } = await params;
    const q = new URL(request.url).searchParams;

    // ── Single-participant drill-down ────────────────────────────────────
    const userId = q.get("userId");
    if (userId) {
      const [answers, rawSnapshots] = await Promise.all([
        getParticipantAnswers(id, userId),
        getParticipantSnapshots(id, userId),
      ]);
      // Sign short-lived GET URLs so the admin can actually view the frames.
      // Best-effort: if R2 isn't configured we still return the metadata.
      const snapshots = rawSnapshots.map((s) => {
        try {
          const signed = createPresignedR2PutUrl({ objectKey: s.r2Key, expiresSeconds: 900, method: "GET" });
          return { ...s, url: signed.url };
        } catch {
          return { ...s, url: null as string | null };
        }
      });
      await recordAuditEvent({
        actorUserId: ctx.userId,
        workspaceId: null,
        entityType: "contest",
        entityId: id,
        action: "contest.participant_detail_viewed",
        after: { participantUserId: userId, answers: answers.length },
      }).catch(() => undefined);
      return teacherJson({ answers, snapshots });
    }

    const reveal = q.get("reveal") === "1";
    const isCsv = q.get("format") === "csv";
    const filter = {
      search: q.get("search"),
      attemptState: (q.get("attemptState") as AttemptState | "all" | null) ?? "all",
      registrationStatus: (q.get("registrationStatus") as "registered" | "waitlisted" | "all" | null) ?? "all",
      flaggedOnly: q.get("flagged") === "1",
      ineligibleOnly: q.get("ineligible") === "1",
      premiumOnly: q.get("premium") === "1",
      autoSubmittedOnly: q.get("autoSubmitted") === "1",
      sort: q.get("sort"),
      // CSV exports the whole filtered set (capped), the table exports a page.
      limit: isCsv ? 200 : Math.min(200, Number(q.get("limit")) || 50),
      offset: isCsv ? 0 : Math.max(0, Number(q.get("offset")) || 0),
      revealMobile: reveal,
    };

    const [summary, page] = await Promise.all([
      getParticipantsSummary(id),
      listContestParticipants(id, filter),
    ]);

    // PII access is always audited; an export and a mobile reveal are called out.
    await recordAuditEvent({
      actorUserId: ctx.userId,
      workspaceId: null,
      entityType: "contest",
      entityId: id,
      action: isCsv ? "contest.participants_exported" : "contest.participants_viewed",
      after: { rows: page.rows.length, total: page.total, revealedMobile: reveal, filter: { ...filter, revealMobile: undefined } },
    }).catch(() => undefined);

    if (isCsv) {
      const header = [
        "rank", "name", "email", "mobile", "premium", "registered_at", "registration_status",
        "team", "attempt_state", "started_at", "finished_at", "auto_submitted", "time_taken_seconds",
        "score", "correct", "incorrect", "unattempted", "accuracy_pct", "percentile",
        "violations", "review_status", "eligible", "orbit_change",
      ];
      const lines = [header.join(",")];
      for (const r of page.rows) {
        lines.push([
          r.rank, r.name, r.email, r.mobile, r.isPremium, r.registeredAt, r.registrationStatus,
          r.teamName, r.attemptState, r.startedAt, r.finishedAt, r.autoSubmitted, r.timeTakenSeconds,
          r.score, r.correct, r.incorrect, r.unattempted, r.accuracyPct, r.percentile,
          r.violationCount, r.reviewStatus, r.eligible, r.ratingChange,
        ].map(csvCell).join(","));
      }
      return new Response(lines.join("\n"), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="contest-${id}-participants.csv"`,
        },
      });
    }

    return teacherJson({ summary, rows: page.rows, total: page.total });
  } catch (error) {
    return handleTeacherError(error);
  }
}

/**
 * POST /api/admin/contest/[id]/participants
 *   { action: 'promote' | 'unregister' | 'disqualify' | 'reinstate' | 'clear_flag' | 'uphold_flag',
 *     userId?, userIds?: string[] }
 *
 * Admin participant actions. `userIds` runs the action over a bulk selection;
 * `promote` with neither runs the FIFO waitlist auto-promotion. Every call is
 * audited. Actions that change eligibility recompute a published leaderboard.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireRole(request, ["admin"]);
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      action?: string; userId?: string; userIds?: string[];
    };
    const action = body.action ?? "";
    const targets = body.userIds?.length ? body.userIds.slice(0, 200) : body.userId ? [body.userId] : [];

    let affected = 0;
    let promoted = 0;

    if (action === "promote" && targets.length === 0) {
      promoted = (await promoteParticipant(id, null)).promoted;
    } else {
      if (targets.length === 0) return teacherJson({ detail: "A userId (or userIds) is required." }, { status: 400 });
      for (const uid of targets) {
        switch (action) {
          case "promote": promoted += (await promoteParticipant(id, uid)).promoted; break;
          case "unregister": promoted += (await unregisterParticipant(id, uid)).promoted; break;
          case "disqualify": await setParticipantEligibility(id, uid, false); break;
          case "reinstate": await setParticipantEligibility(id, uid, true); break;
          case "clear_flag": await clearFlaggedAttempt(id, uid); break;
          case "uphold_flag": await upholdFlaggedAttempt(id, uid); break;
          default: return teacherJson({ detail: `Unknown action '${action}'.` }, { status: 400 });
        }
        affected += 1;
      }
    }

    await recordAuditEvent({
      actorUserId: ctx.userId,
      workspaceId: null,
      entityType: "contest",
      entityId: id,
      action: `contest.participant_${action}`,
      after: { affected, promoted, targets: targets.length },
    }).catch(() => undefined);

    return teacherJson({ ok: true, affected, promoted });
  } catch (error) {
    return handleTeacherError(error);
  }
}
