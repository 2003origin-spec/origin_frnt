/**
 * Custom DPP-from-mistakes (plan Phase 8c). After results publish, a
 * participant can pull a personalised practice set built from the questions they
 * got WRONG in the contest: we read the wrong answers from the immutable
 * contest.submission_answers snapshots, derive the weak chapters, and source
 * FRESH OGCode questions on those chapters (excluding the contest's own
 * question ids so it's genuinely new practice).
 *
 * Gated (fail-closed): only after RESULT_PUBLISHED, only for a REGISTERED user,
 * and only for a PREMIUM-entitled one (live entitlement union — NOT the
 * is_premium mirror). A non-entitled user gets a locked response so the UI can
 * show "Subscribe to unlock".
 */

import { listOgcodeCatalogQuestionPage } from "@/server/ogcode-catalog";
import { getEntitledSubjects } from "@/server/entitlements";
import { getUserPostgresPool } from "@/server/user-postgres";

import { isRegisteredForContest } from "./contest-registration-service";
import { ensureContestSchema } from "./contest-schema";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function dppError(status: number, message: string, code?: string): Error & { status: number; code?: string } {
  const err = new Error(message) as Error & { status: number; code?: string };
  err.status = status;
  if (code) err.code = code;
  return err;
}

export interface DppQuestion {
  id: string;
  text: string;
  options: string[] | null;
  subject: string;
  chapter: string;
  questionType: string;
}

export type ContestDppResult =
  | { locked: true; reason: "not_registered" | "not_premium" | "not_published"; entitledSubjects?: string[] }
  | { locked: false; weakChapters: string[]; questions: DppQuestion[] };

/**
 * Build the custom DPP for a user's contest mistakes. Returns a locked marker
 * (for the UI to gate) rather than throwing on the entitlement/registration
 * gates, so the surface can render the "Subscribe to unlock" state.
 */
export async function getContestMistakeDpp(contestId: string, userId: string): Promise<ContestDppResult> {
  await ensureContestSchema();
  const p = pool();

  // Only after results are published.
  const contest = await p.query(`SELECT status FROM contest.contests WHERE id = $1`, [contestId]);
  if (!contest.rows[0]) throw dppError(404, "Contest not found.");
  const status = contest.rows[0].status;
  if (status !== "result_published" && status !== "archived") {
    return { locked: true, reason: "not_published" };
  }

  // Registered (authoritative row check).
  if (!(await isRegisteredForContest(contestId, userId))) {
    return { locked: true, reason: "not_registered" };
  }

  // Premium — live entitlement union (never the is_premium mirror).
  const entitled = await getEntitledSubjects(userId);
  if (entitled.length === 0) {
    return { locked: true, reason: "not_premium" };
  }

  // The wrong-answer questions from the immutable snapshot → weak chapters.
  const wrong = await p.query<{ question_snapshot: Record<string, unknown> }>(
    `SELECT question_snapshot FROM contest.submission_answers
      WHERE contest_id = $1 AND user_id = $2 AND is_correct = false`,
    [contestId, userId],
  );
  const weakChapters = Array.from(
    new Set(
      wrong.rows
        .map((r) => String((r.question_snapshot as { chapter?: string } | null)?.chapter ?? "").trim())
        .filter(Boolean),
    ),
  );

  // The exact contest question ids to EXCLUDE (so the DPP is fresh practice).
  const contestIds = await p.query<{ question_id: string }>(
    `SELECT question_id FROM contest.contest_questions WHERE contest_id = $1`,
    [contestId],
  );
  const excludeIds = contestIds.rows.map((r) => r.question_id);

  if (weakChapters.length === 0) {
    return { locked: false, weakChapters: [], questions: [] };
  }

  // Fresh questions on the weak chapters, scoped to the user's entitled subjects.
  const page = await listOgcodeCatalogQuestionPage({
    subjects: entitled as string[],
    chapters: weakChapters,
    excludeIds,
    limit: 20,
    offset: 0,
  });
  const questions: DppQuestion[] = page.items.map((q) => ({
    id: q.id,
    text: q.text,
    options: q.options,
    subject: q.subject,
    chapter: q.chapter,
    questionType: q.questionType,
  }));

  return { locked: false, weakChapters, questions };
}
