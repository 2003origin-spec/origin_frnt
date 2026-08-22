/**
 * GET /api/contest/result?contestId=  — the caller's own contest result
 * (rank, percentile, score, subject-wise section scores). HARD-gated on
 * status=result_published: 403 in every earlier state so results never leak
 * during/after the contest until published. Plan Phase 6.
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireAuth } from "@/server/authz";
import { getUserPostgresReplicaPool } from "@/server/user-postgres";
import { getPersonalResult } from "@/server/contest/contest-ranking-service";
import { getOrbitSummary } from "@/server/contest/contest-orbit-service";
import { ensureContestSchema } from "@/server/contest/contest-schema";
import { normalizeScoringConfig } from "@/lib/contest/contest-config";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireAuth(request);
    const contestId = new URL(request.url).searchParams.get("contestId");
    if (!contestId) return teacherJson({ detail: "contestId is required." }, { status: 400 });

    await ensureContestSchema();
    const pool = getUserPostgresReplicaPool();
    if (!pool) return teacherJson({ detail: "Unavailable." }, { status: 503 });

    const contest = await pool.query(`SELECT status, name, scoring_config FROM contest.contests WHERE id = $1`, [contestId]);
    if (!contest.rows[0]) return teacherJson({ detail: "Contest not found." }, { status: 404 });
    // Hard gate: results are hidden until published.
    if (contest.rows[0].status !== "result_published" && contest.rows[0].status !== "archived") {
      return teacherJson({ detail: "Results are not published yet." }, { status: 403 });
    }

    const [personal, attempt, orbit, orbitDelta] = await Promise.all([
      getPersonalResult(contestId, ctx.userId),
      pool.query(
        `SELECT score, correct_count, incorrect_count, unattempted_count, time_taken_seconds, section_scores
           FROM contest.attempts WHERE contest_id = $1 AND user_id = $2 AND finished_at IS NOT NULL`,
        [contestId, ctx.userId],
      ),
      getOrbitSummary(ctx.userId),
      // The rating change FROM THIS contest specifically (history row).
      pool.query(
        `SELECT rating_before, rating_after, rating_change
           FROM contest.orbit_history WHERE contest_id = $1 AND user_id = $2`,
        [contestId, ctx.userId],
      ),
    ]);

    return teacherJson({
      contestName: contest.rows[0].name,
      // Marks-per-correct so the client can render the true out-of total instead
      // of assuming a fixed scale.
      correctMarks: normalizeScoringConfig(contest.rows[0].scoring_config).correctMarks,
      personal,
      orbit,
      orbitMovement: orbitDelta.rows[0]
        ? {
            before: Math.round(Number(orbitDelta.rows[0].rating_before)),
            after: Math.round(Number(orbitDelta.rows[0].rating_after)),
            change: Math.round(Number(orbitDelta.rows[0].rating_change)),
          }
        : null,
      attempt: attempt.rows[0]
        ? {
            score: Number(attempt.rows[0].score),
            correct: attempt.rows[0].correct_count,
            incorrect: attempt.rows[0].incorrect_count,
            unattempted: attempt.rows[0].unattempted_count,
            timeTakenSeconds: attempt.rows[0].time_taken_seconds,
            sectionScores: attempt.rows[0].section_scores,
          }
        : null,
    });
  } catch (error) {
    return handleTeacherError(error);
  }
}
