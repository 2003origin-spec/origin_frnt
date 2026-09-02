/**
 * Answer-key objections + re-grade (Phase 2A). A student challenges a question's
 * key after results; an admin accepts (correcting the MCQ key and re-grading the
 * affected question across all attempts, then re-ranking) or rejects.
 *
 * Re-grade is scoped to the ONE corrected question: it recomputes that position's
 * is_correct/marks for every submission, adjusts each attempt's total score by the
 * delta, then rebuilds the leaderboard via rankContest. (ORBIT rating is left to
 * the next ranking pass; scores + ranks are corrected here.)
 */

import { getUserPostgresPool } from "@/server/user-postgres";
import { createId } from "@/legacy/store";

import { ensureContestSchema } from "./contest-schema";
import { normalizeScoringConfig } from "@/lib/contest/contest-config";
import { rankContest } from "./contest-ranking-service";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function objError(status: number, message: string): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

export interface KeyObjection {
  id: string;
  contestId: string;
  position: number;
  userId: string;
  reason: string;
  status: "open" | "accepted" | "rejected";
  createdAt: string;
}

/** Student files an objection (post-result; the route enforces published). */
export async function fileKeyObjection(input: {
  contestId: string;
  position: number;
  userId: string;
  reason: string;
}): Promise<KeyObjection> {
  await ensureContestSchema();
  const reason = input.reason.trim().slice(0, 1000);
  if (!reason) throw objError(400, "A reason is required.");
  const id = createId("obj");
  await pool().query(
    `INSERT INTO contest.key_objections (id, contest_id, position, user_id, reason)
       VALUES ($1, $2, $3, $4, $5)`,
    [id, input.contestId, input.position, input.userId, reason],
  );
  return { id, contestId: input.contestId, position: input.position, userId: input.userId, reason, status: "open", createdAt: new Date().toISOString() };
}

/** Admin: list objections for a contest (open first). */
export async function listKeyObjections(contestId: string): Promise<(KeyObjection & { authorName: string })[]> {
  await ensureContestSchema();
  const res = await pool().query<{ id: string; position: number; user_id: string; reason: string; status: string; created_at: string; name: string | null }>(
    `SELECT o.id, o.position, o.user_id, o.reason, o.status, o.created_at, u.name
       FROM contest.key_objections o JOIN origin_users u ON u.id = o.user_id
      WHERE o.contest_id = $1
      ORDER BY (o.status = 'open') DESC, o.created_at DESC`,
    [contestId],
  );
  return res.rows.map((r) => ({
    id: r.id, contestId, position: r.position, userId: r.user_id, reason: r.reason,
    status: r.status as KeyObjection["status"], createdAt: new Date(r.created_at).toISOString(),
    authorName: (r.name || "Anonymous").trim().split(/\s+/)[0],
  }));
}

/**
 * Accept an objection: set the new MCQ correct option on the frozen snapshot for
 * that position, re-grade the question across all attempts, adjust totals, and
 * re-rank. `reject` just marks the objection rejected.
 */
export async function resolveKeyObjection(input: {
  objectionId: string;
  adminId: string;
  action: "accept" | "reject";
  newCorrectOption?: number;
}): Promise<{ regraded?: number }> {
  await ensureContestSchema();
  const p = pool();
  const obj = await p.query<{ contest_id: string; position: number; status: string }>(
    `SELECT contest_id, position, status FROM contest.key_objections WHERE id = $1`,
    [input.objectionId],
  );
  if (!obj.rows[0]) throw objError(404, "Objection not found.");
  if (obj.rows[0].status !== "open") throw objError(409, "This objection is already resolved.");
  const { contest_id: contestId, position } = obj.rows[0];

  if (input.action === "reject") {
    await p.query(
      `UPDATE contest.key_objections SET status = 'rejected', resolved_by = $2, resolved_at = NOW() WHERE id = $1`,
      [input.objectionId, input.adminId],
    );
    return {};
  }

  if (typeof input.newCorrectOption !== "number" || input.newCorrectOption < 0) {
    throw objError(400, "A new correct option is required to accept an objection.");
  }

  // Scoring config for this contest (for the marks recompute).
  const cRow = await p.query<{ scoring_config: unknown }>(`SELECT scoring_config FROM contest.contests WHERE id = $1`, [contestId]);
  const cfg = normalizeScoringConfig(cRow.rows[0]?.scoring_config);

  // Correct the frozen snapshot key for that position.
  const qRow = await p.query<{ snapshot: Record<string, unknown>; marks: number | null; negative_marks: number | null }>(
    `SELECT snapshot, marks, negative_marks FROM contest.contest_questions WHERE contest_id = $1 AND position = $2`,
    [contestId, position],
  );
  if (!qRow.rows[0]) throw objError(404, "Question not found in the frozen paper.");
  const snapshot = { ...(qRow.rows[0].snapshot ?? {}), correctOption: input.newCorrectOption };
  await p.query(
    `UPDATE contest.contest_questions SET snapshot = $3::jsonb WHERE contest_id = $1 AND position = $2`,
    [contestId, position, JSON.stringify(snapshot)],
  );

  const correctMarks = qRow.rows[0].marks ?? cfg.correctMarks;
  const incorrectMarks = qRow.rows[0].negative_marks ?? cfg.incorrectMarks;

  // Re-grade every submission at this position; adjust the attempt total by delta.
  const subs = await p.query<{ user_id: string; submitted_answer: Record<string, unknown> | null; is_correct: boolean | null; marks_awarded: number | null }>(
    `SELECT user_id, submitted_answer, is_correct, marks_awarded FROM contest.submission_answers WHERE contest_id = $1 AND position = $2`,
    [contestId, position],
  );
  let regraded = 0;
  for (const s of subs.rows) {
    const sel = s.submitted_answer?.selectedOption;
    const answered = s.submitted_answer != null && Object.keys(s.submitted_answer).length > 0;
    const nowCorrect = typeof sel === "number" && sel === input.newCorrectOption;
    const newMarks = nowCorrect ? correctMarks : answered ? incorrectMarks : cfg.unattemptedMarks;
    const oldMarks = s.marks_awarded ?? 0;
    if (nowCorrect === s.is_correct && newMarks === oldMarks) continue; // unchanged
    const delta = newMarks - oldMarks;
    await p.query(
      `UPDATE contest.submission_answers SET is_correct = $3, marks_awarded = $4 WHERE contest_id = $1 AND user_id = $2 AND position = $5`,
      [contestId, s.user_id, nowCorrect, newMarks, position],
    );
    await p.query(
      `UPDATE contest.attempts SET score = COALESCE(score, 0) + $3 WHERE contest_id = $1 AND user_id = $2`,
      [contestId, s.user_id, delta],
    );
    regraded += 1;
  }

  await p.query(
    `UPDATE contest.key_objections SET status = 'accepted', resolved_by = $2, resolved_at = NOW() WHERE id = $1`,
    [input.objectionId, input.adminId],
  );
  // Rebuild the leaderboard off the corrected attempt scores.
  await rankContest(contestId).catch(() => undefined);
  return { regraded };
}
