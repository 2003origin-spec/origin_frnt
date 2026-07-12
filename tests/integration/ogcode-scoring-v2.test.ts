/**
 * OGCode Scoring V2 — retry-loop integration test
 * (V1/OGCODE_SCORING_ALGORITHM.md, Phase 6 verification gate).
 *
 * Exercises the REAL submitPracticeQuestion flow against the live OGCode
 * Postgres (docker-compose dev DB or CI Postgres): atomic TA increments,
 * non-terminal retry responses that withhold the answer, cap-exhaustion
 * forced reveal, terminal-outcome-only side effects, hint decay, the
 * re-attempt zero-score rule, and flag-off legacy behavior.
 *
 * Skips when OGCODE_DATABASE_URL is not configured. Run:
 *   npx tsx --env-file=.env.local --test tests/integration/ogcode-scoring-v2.test.ts
 *
 * Leaves GRADER_SERVICE_URL alone — when the grader isn't reachable the
 * client falls back to local gradeAnswer(), which is all this test needs.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";

import {
  submitPracticeQuestion as submitPracticeQuestionRaw,
  getPracticeQuestionDetail as getPracticeQuestionDetailRaw,
} from "@/legacy/assessments";
import type { AppStore, StoredUser } from "@/legacy/store";
import { OGCODE_BASE_SCORING } from "@/server/ogcode-scoring";
import { getOgcodeQuestionProgress, markOgcodeRevealed } from "@/server/ogcode-progress";

// The V2 and legacy return shapes are a union; assertions poke at optional
// fields across both branches, so treat the result as a loose record here.
type SubmitResult = Record<string, unknown>;
const submitPracticeQuestion = submitPracticeQuestionRaw as (
  ...args: Parameters<typeof submitPracticeQuestionRaw>
) => Promise<SubmitResult>;
const getPracticeQuestionDetail = getPracticeQuestionDetailRaw as (
  ...args: Parameters<typeof getPracticeQuestionDetailRaw>
) => Promise<Record<string, unknown>>;

const dbConfigured = Boolean(process.env.OGCODE_DATABASE_URL);

const TEST_USER_ID = `u_scoringv2_${Math.random().toString(36).slice(2, 10)}`;

function makeStore(): AppStore {
  return {
    users: [],
    streaks: [],
    dailyActivities: [],
    dailySubjectActivities: [],
    pomodoroSessions: [],
    userScores: [],
    pointLogs: [],
    questions: [],
    tests: [],
    testResults: [],
    practiceAttempts: [],
    dpps: [],
    assignments: [],
    subjectRanks: [],
    books: [],
    notes: [],
    bookmarks: [],
    savedBooks: [],
    doubtSessions: [],
    originAiProfiles: [],
    originAiSessions: [],
    originAiReminders: [],
    authSessions: [],
    leaderboardSeed: [],
    tasks: [],
    otps: [],
  } as unknown as AppStore;
}

function makeUser(): StoredUser {
  return {
    id: TEST_USER_ID,
    name: "Scoring V2 Test",
    email: `${TEST_USER_ID}@test.local`,
    role: "student",
  } as unknown as StoredUser;
}

type CatalogPick = { id: string; difficulty: string; answer: string };

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.OGCODE_DATABASE_URL });
  }
  return pool;
}

/**
 * Numerical questions dodge the option-shuffle presentation layer entirely —
 * the reconciled option-less rows carry their accepted answer in
 * correct_options (surfaced as answerText at read time).
 */
async function pickNumericalQuestions(count: number): Promise<CatalogPick[]> {
  // Restrict to rows whose single stored answer is actually NUMERIC — the
  // reconciled "numerical" bucket also contains text fill-in-the-blank answers
  // (e.g. "Urethra"), which the numerical grader can't match. Numeric answers
  // give the local gradeAnswer() a deterministic correct/incorrect verdict.
  const result = await getPool().query<{ id: string; difficulty: string; correct_options: string[] }>(
    `SELECT id, difficulty, correct_options
       FROM ogcode_questions
      WHERE LOWER(question_type) = 'mcq'
        AND (options IS NULL OR jsonb_typeof(options) <> 'array' OR jsonb_array_length(options) = 0)
        AND correct_options IS NOT NULL
        AND jsonb_typeof(correct_options) = 'array'
        AND jsonb_array_length(correct_options) = 1
        AND (correct_options->>0) ~ '^[-+]?[0-9]*\\.?[0-9]+$'
      ORDER BY source_index ASC
      LIMIT $1`,
    [count],
  );
  return result.rows.map((row) => ({
    id: row.id,
    difficulty: String(row.difficulty).toLowerCase(),
    answer: String(row.correct_options[0]),
  }));
}

async function cleanup(questionIds: string[], statDeltas: Map<string, { freq: number; correct: number }>) {
  const p = getPool();
  await p.query(`DELETE FROM ogcode_question_progress WHERE user_id = $1`, [TEST_USER_ID]);
  // Undo the global-stat increments this test caused so repeat runs don't skew
  // acceptance_rate on the dev seed rows.
  for (const [id, delta] of statDeltas) {
    if (delta.freq === 0 && delta.correct === 0) continue;
    await p.query(
      `UPDATE ogcode_questions
          SET frequency = GREATEST(0, frequency - $2),
              total_correct = GREATEST(0, total_correct - $3),
              acceptance_rate = CASE WHEN GREATEST(0, frequency - $2) > 0
                THEN (GREATEST(0, total_correct - $3)::double precision / GREATEST(0, frequency - $2)::double precision) * 100
                ELSE 0 END
        WHERE id = $1`,
      [id, delta.freq, delta.correct],
    );
  }
  await p.end();
  pool = null;
}

test("scoring v2: retry loop, cap exhaustion, hint decay, re-attempt, flag-off", { skip: !dbConfigured }, async () => {
  process.env.TEACHER_LAUNCH_OGCODE_SCORING_V2 = "1";
  const statDeltas = new Map<string, { freq: number; correct: number }>();
  const bump = (id: string, correct: boolean) => {
    const entry = statDeltas.get(id) ?? { freq: 0, correct: 0 };
    entry.freq += 1;
    if (correct) entry.correct += 1;
    statDeltas.set(id, entry);
  };

  const picks = await pickNumericalQuestions(4);
  assert.ok(picks.length >= 4, "needs 4 numerical (reconciled) catalog questions — run the ogcode import first");
  const [q1, q2, q3, q4] = picks;

  const store = makeStore();
  const user = makeUser();

  try {
    // ── 1. Wrong answers stay in the loop: no side effects, answer withheld ──
    const wrong1 = await submitPracticeQuestion(store, user, q1.id, {
      answer_text: "999999.123",
      time_spent: 10,
    });
    assert.equal(wrong1.terminal, false);
    assert.equal(wrong1.isCorrect, false);
    assert.equal(wrong1.attemptsUsed, 1);
    assert.equal(wrong1.attemptsRemaining, 3);
    assert.equal("correctAnswerText" in wrong1, false, "mid-loop response must not leak the answer");
    assert.equal("explanation" in wrong1, false, "mid-loop response must not leak the explanation");
    assert.equal(store.practiceAttempts.length, 0, "no attempt row mid-loop");
    assert.equal(store.pointLogs.length, 0, "no points mid-loop");

    const wrong2 = await submitPracticeQuestion(store, user, q1.id, { answer_text: "999999.123", time_spent: 20 });
    const wrong3 = await submitPracticeQuestion(store, user, q1.id, { answer_text: "999999.123", time_spent: 30 });
    assert.equal(wrong2.attemptsRemaining, 2);
    assert.equal(wrong3.attemptsRemaining, 1);

    // ── 2. 4th wrong = cap exhausted: terminal, 0 marks, forced answer reveal ──
    const exhausted = await submitPracticeQuestion(store, user, q1.id, { answer_text: "999999.123", time_spent: 40 });
    bump(q1.id, false);
    assert.equal(exhausted.terminal, true);
    assert.equal(exhausted.isCorrect, false);
    assert.equal(exhausted.resultScore, 0);
    assert.equal(exhausted.attemptsUsed, 4);
    assert.ok(typeof exhausted.correctAnswerText === "string" || exhausted.explanation, "terminal reveals the solution info");
    assert.equal(store.practiceAttempts.length, 1, "exactly one attempt row for the whole session");
    assert.equal(store.practiceAttempts[0].attemptNumber, 4);
    assert.equal(store.practiceAttempts[0].answerRevealed, true);

    const q1Progress = await getOgcodeQuestionProgress(TEST_USER_ID, q1.id);
    assert.equal(q1Progress.attempted, true);
    assert.equal(q1Progress.answerRevealed, true, "cap exhaustion routes through the reveal implementation");
    assert.notEqual(q1Progress.firstTerminalAt, null);

    // ── 3. Re-attempt after terminal: graded, recorded, but zero-scored ──
    const reattempt = await submitPracticeQuestion(store, user, q1.id, { answer_text: q1.answer, time_spent: 5 });
    bump(q1.id, true);
    assert.equal(reattempt.terminal, true);
    assert.equal(reattempt.isCorrect, true);
    assert.equal(reattempt.resultScore, 0, "already-attempted questions never re-score");
    assert.equal(reattempt.pointsAwarded, 0);
    assert.equal(reattempt.already_solved, true);

    // ── 4. Fresh question, correct on attempt 2: divisor applies ──
    await submitPracticeQuestion(store, user, q2.id, { answer_text: "999999.123", time_spent: 5 });
    const secondTry = await submitPracticeQuestion(store, user, q2.id, { answer_text: q2.answer, time_spent: 10 });
    bump(q2.id, true);
    const q2Base = OGCODE_BASE_SCORING[q2.difficulty as keyof typeof OGCODE_BASE_SCORING] ?? OGCODE_BASE_SCORING.medium;
    assert.equal(secondTry.terminal, true);
    assert.equal(secondTry.isCorrect, true);
    assert.equal(secondTry.resultScore, Math.round((q2Base.bs / 2) * 100) / 100, "fast solve on attempt 2 = bs/2");
    assert.equal(secondTry.pointsAwarded, secondTry.resultScore);
    assert.ok((secondTry.scoreReasons as string[]).includes("attempt_divisor:2"));

    // ── 5. Hint decay: reveal → correct first try = bs/2 ──
    const reveal = await markOgcodeRevealed(TEST_USER_ID, q3.id, "hint");
    assert.equal(reveal.firstReveal, true);
    const withHint = await submitPracticeQuestion(store, user, q3.id, { answer_text: q3.answer, time_spent: 5 });
    bump(q3.id, true);
    const q3Base = OGCODE_BASE_SCORING[q3.difficulty as keyof typeof OGCODE_BASE_SCORING] ?? OGCODE_BASE_SCORING.medium;
    assert.equal(withHint.resultScore, Math.round((q3Base.bs / 2) * 100) / 100);
    assert.ok((withHint.scoreReasons as string[]).includes("hint_decay"));

    // ── 6. Flag off: legacy path, byte-identical shape ──
    process.env.TEACHER_LAUNCH_OGCODE_SCORING_V2 = "0";
    const legacy = await submitPracticeQuestion(store, user, q4.id, { answer_text: q4.answer, time_spent: 10 });
    bump(q4.id, true);
    assert.equal(legacy.terminal, undefined, "legacy response has no terminal field");
    assert.ok(legacy.speedBand, "legacy response keeps the speed band");
    assert.equal(typeof legacy.resultScore, "number");
    const q4Progress = await getOgcodeQuestionProgress(TEST_USER_ID, q4.id);
    assert.equal(q4Progress.totalAttempts, 0, "flag off never touches the progress table");
  } finally {
    delete process.env.TEACHER_LAUNCH_OGCODE_SCORING_V2;
    await cleanup([q1.id, q2.id, q3.id, q4.id], statDeltas);
  }
});

/**
 * The client (OGCodeWorkspace) restores mid-loop state on refresh purely from
 * getPracticeQuestionDetail's V2 fields — there's no trusted local counter.
 * This proves the exact contract that a browser refresh would exercise, which
 * can't be click-tested headlessly.
 */
test("scoring v2: question detail surfaces progress for refresh-restore", { skip: !dbConfigured }, async () => {
  process.env.TEACHER_LAUNCH_OGCODE_SCORING_V2 = "1";
  const statDeltas = new Map<string, { freq: number; correct: number }>();
  const picks = await pickNumericalQuestions(2);
  assert.ok(picks.length >= 2, "needs 2 numerical catalog questions");
  const [q1, q2] = picks;
  const store = makeStore();
  const user = makeUser();

  try {
    // Fresh question: detail advertises V2 with a full attempt budget.
    const fresh = await getPracticeQuestionDetail(store, user, q1.id);
    assert.equal(fresh.scoringV2, true, "flag on + catalog → detail is V2-aware");
    assert.equal(fresh.attemptsUsed, 0);
    assert.equal(fresh.attemptCap, 4, "numerical cap is 4");
    assert.equal(fresh.attemptsRemaining, 4);
    assert.equal(fresh.terminalReached, false);
    assert.equal(fresh.hintRevealed, false);
    assert.equal(fresh.answerRevealed, false);

    // Burn two wrong attempts, then re-fetch detail (simulates a refresh).
    await submitPracticeQuestion(store, user, q1.id, { answer_text: "999999.123", time_spent: 5 });
    await submitPracticeQuestion(store, user, q1.id, { answer_text: "999999.123", time_spent: 5 });
    const midLoop = await getPracticeQuestionDetail(store, user, q1.id);
    assert.equal(midLoop.attemptsUsed, 2, "refresh restores burned attempts from the server");
    assert.equal(midLoop.attemptsRemaining, 2);
    assert.equal(midLoop.terminalReached, false);

    // After a hint reveal, detail reports the decay flag so the client can
    // show "score halved" without re-triggering the decay.
    await markOgcodeRevealed(TEST_USER_ID, q1.id, "hint");
    const afterHint = await getPracticeQuestionDetail(store, user, q1.id);
    assert.equal(afterHint.hintRevealed, true);
    assert.equal(afterHint.progressAttempted, true, "reveal flips attempted");

    // Flag off: detail carries NO V2 fields (legacy client path).
    process.env.TEACHER_LAUNCH_OGCODE_SCORING_V2 = "0";
    const legacyDetail = await getPracticeQuestionDetail(store, user, q2.id);
    assert.equal(legacyDetail.scoringV2, undefined, "flag off → no V2 fields on detail");
  } finally {
    delete process.env.TEACHER_LAUNCH_OGCODE_SCORING_V2;
    await cleanup([q1.id, q2.id], statDeltas);
  }
});
