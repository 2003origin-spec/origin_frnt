/**
 * OGCode Engagement (Part 2 §9-13) integration tests against the live OGCode
 * Postgres. Each test inserts its OWN throwaway question row(s) and cleans up,
 * so it never pollutes the seed data's shared counters.
 *
 * Skips when OGCODE_DATABASE_URL is not configured. Run:
 *   GRADER_SERVICE_URL= npx tsx --env-file=.env.local --test tests/integration/ogcode-engagement.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";

import {
  incrementOgcodeCatalogQuestionStats,
  getOgcodeQuestionStatsMessage,
  listOgcodeCatalogQuestionPage,
} from "@/server/ogcode-catalog";
import {
  toggleOgcodeQuestionLike,
  getOgcodeLikeInfo,
  getOgcodeLikeInfoMap,
} from "@/server/ogcode-likes";
import { submitOgcodeQuestionReport } from "@/server/ogcode-reports";
import {
  createOgcodeChallenge,
  listOgcodeChallengeInbox,
  countOgcodePendingChallenges,
  completeOgcodeChallengesForAttempt,
} from "@/server/ogcode-challenges";

const dbConfigured = Boolean(process.env.OGCODE_DATABASE_URL);

let pool: Pool | null = null;
function getPool(): Pool {
  if (!pool) pool = new Pool({ connectionString: process.env.OGCODE_DATABASE_URL });
  return pool;
}

async function insertThrowawayQuestion(id: string): Promise<void> {
  await getPool().query(
    `INSERT INTO ogcode_questions
       (id, source_index, text, explanation, subject, chapter, concept, difficulty, question_type)
     VALUES ($1, $2, 'throwaway', 'x', 'physics', 'test', 'test', 'medium', 'numerical')
     ON CONFLICT (id) DO NOTHING`,
    [id, -Math.floor(Math.random() * 1_000_000) - 1],
  );
}

async function cleanupQuestion(id: string): Promise<void> {
  const p = getPool();
  await p.query(`DELETE FROM ogcode_question_time_buckets WHERE question_id = $1`, [id]);
  await p.query(`DELETE FROM ogcode_questions WHERE id = $1`, [id]);
}

test("§9: stats writes + faster-than-X% message", { skip: !dbConfigured }, async () => {
  const qid = `q_engagement_${Math.random().toString(36).slice(2, 10)}`;
  await insertThrowawayQuestion(qid);

  try {
    // Ten fast correct solves at ~10s (bucket 2) + one slow at ~200s (bucket 40).
    for (let i = 0; i < 10; i += 1) {
      await incrementOgcodeCatalogQuestionStats(qid, true, {
        timeSpentSeconds: 10,
        firstAttempt: true,
        firstAttemptCorrect: true,
      });
    }
    await incrementOgcodeCatalogQuestionStats(qid, false, {
      timeSpentSeconds: 200,
      firstAttempt: true,
      firstAttemptCorrect: false,
    });

    const row = await getPool().query(
      `SELECT frequency, total_correct, correct_time_count, first_attempt_total, first_attempt_correct
         FROM ogcode_questions WHERE id = $1`,
      [qid],
    );
    assert.equal(Number(row.rows[0].frequency), 11);
    assert.equal(Number(row.rows[0].total_correct), 10);
    assert.equal(Number(row.rows[0].correct_time_count), 10, "only correct solves feed the histogram");
    assert.equal(Number(row.rows[0].first_attempt_total), 11);
    assert.equal(Number(row.rows[0].first_attempt_correct), 10);

    const buckets = await getPool().query(
      `SELECT bucket_index, count FROM ogcode_question_time_buckets WHERE question_id = $1 ORDER BY bucket_index`,
      [qid],
    );
    assert.deepEqual(
      buckets.rows.map((r) => [Number(r.bucket_index), Number(r.count)]),
      [[2, 10]],
      "10 solves at 10s all land in bucket 2 (the 200s wrong answer isn't recorded)",
    );

    // A solver at 8s (bucket 1) is faster than none of the 10 (all at bucket 2)? No —
    // bucket 1 < bucket 2, so 10 solvers are STRICTLY SLOWER → faster than 100%.
    const fastMsg = await getOgcodeQuestionStatsMessage(qid, { timeSpentSeconds: 8, isCorrect: true });
    assert.equal(fastMsg?.fasterThanPercent, 100);
    assert.equal(fastMsg?.acceptanceRate, Math.round((10 / 11) * 100));
    // 11 completers, 10 first-try-correct → 1 needed a retry → 9%.
    assert.equal(fastMsg?.neededRetryPercent, Math.round((1 / 11) * 100));
    assert.equal(fastMsg?.isFirstEver, false);

    // A solver in the same bucket (10s → bucket 2) is faster than nobody strictly slower.
    const sameMsg = await getOgcodeQuestionStatsMessage(qid, { timeSpentSeconds: 10, isCorrect: true });
    assert.equal(sameMsg?.fasterThanPercent, 0);
  } finally {
    await cleanupQuestion(qid);
  }
});

test("§9: cold-start (first ever) suppresses percentile", { skip: !dbConfigured }, async () => {
  const qid = `q_engagement_${Math.random().toString(36).slice(2, 10)}`;
  await insertThrowawayQuestion(qid);
  try {
    await incrementOgcodeCatalogQuestionStats(qid, true, {
      timeSpentSeconds: 12,
      firstAttempt: true,
      firstAttemptCorrect: true,
    });
    const msg = await getOgcodeQuestionStatsMessage(qid, { timeSpentSeconds: 12, isCorrect: true });
    assert.equal(msg?.isFirstEver, true, "one completer → cold start");
    assert.equal(msg?.fasterThanPercent, null, "no percentile below the 5-sample floor");
    assert.equal(msg?.neededRetryPercent, null);
  } finally {
    await cleanupQuestion(qid);
  }
});

test("§10: like toggle idempotency, public count, and filter EXISTS", { skip: !dbConfigured }, async () => {
  const qid = `q_engagement_${Math.random().toString(36).slice(2, 10)}`;
  const userA = `u_like_${Math.random().toString(36).slice(2, 8)}`;
  const userB = `u_like_${Math.random().toString(36).slice(2, 8)}`;
  await insertThrowawayQuestion(qid);

  try {
    // A likes → count 1, likedByMe true. B likes → count 2.
    let a = await toggleOgcodeQuestionLike(userA, qid);
    assert.equal(a.likedByMe, true);
    assert.equal(a.count, 1);
    const b = await toggleOgcodeQuestionLike(userB, qid);
    assert.equal(b.count, 2);

    // Count is public; each viewer sees their own flag.
    assert.equal((await getOgcodeLikeInfo(userA, qid)).count, 2);
    assert.equal((await getOgcodeLikeInfo(userA, qid)).likedByMe, true);
    assert.equal((await getOgcodeLikeInfo(`u_stranger`, qid)).likedByMe, false);

    // Filter EXISTS: the liked question is returned for A, excluded for a stranger.
    const forA = await listOgcodeCatalogQuestionPage({ likedByUserId: userA, limit: 50, offset: 0 });
    assert.ok(forA.items.some((q) => q.id === qid), "liked question shows under A's Liked filter");
    const forStranger = await listOgcodeCatalogQuestionPage({ likedByUserId: "u_stranger", limit: 50, offset: 0 });
    assert.ok(!forStranger.items.some((q) => q.id === qid), "not shown to a non-liker");

    // A toggles off → count 1, likedByMe false.
    a = await toggleOgcodeQuestionLike(userA, qid);
    assert.equal(a.likedByMe, false);
    assert.equal(a.count, 1);

    // Batch map reflects the final state.
    const map = await getOgcodeLikeInfoMap(userB, [qid]);
    assert.equal(map.get(qid)?.count, 1);
    assert.equal(map.get(qid)?.likedByMe, true, "B still likes it");
  } finally {
    await getPool().query(`DELETE FROM ogcode_question_likes WHERE question_id = $1`, [qid]);
    await cleanupQuestion(qid);
  }
});

test("§11: report upsert refreshes reason but preserves resolved status", { skip: !dbConfigured }, async () => {
  const qid = `q_engagement_${Math.random().toString(36).slice(2, 10)}`;
  const uid = `u_report_${Math.random().toString(36).slice(2, 8)}`;
  await insertThrowawayQuestion(qid);

  try {
    await submitOgcodeQuestionReport(uid, qid, "incorrect_answer", "the key is wrong");
    let row = await getPool().query(
      `SELECT reason, description, status FROM ogcode_question_reports WHERE question_id = $1 AND user_id = $2`,
      [qid, uid],
    );
    assert.equal(row.rows.length, 1, "one row per (question, user)");
    assert.equal(row.rows[0].reason, "incorrect_answer");
    assert.equal(row.rows[0].status, "open");

    // Simulate a moderator resolving it.
    await getPool().query(
      `UPDATE ogcode_question_reports SET status = 'resolved' WHERE question_id = $1 AND user_id = $2`,
      [qid, uid],
    );

    // Student re-reports: reason/description refresh, but status stays resolved
    // (upsert must not reopen a moderator decision) and no duplicate row.
    await submitOgcodeQuestionReport(uid, qid, "typo_or_formatting", "also a typo");
    row = await getPool().query(
      `SELECT reason, description, status FROM ogcode_question_reports WHERE question_id = $1 AND user_id = $2`,
      [qid, uid],
    );
    assert.equal(row.rows.length, 1, "still one row — upsert, not duplicate");
    assert.equal(row.rows[0].reason, "typo_or_formatting", "reason refreshed");
    assert.equal(row.rows[0].description, "also a typo");
    assert.equal(row.rows[0].status, "resolved", "status preserved on conflict");
  } finally {
    await getPool().query(`DELETE FROM ogcode_question_reports WHERE question_id = $1`, [qid]);
    await cleanupQuestion(qid);
  }
});

test("§13: challenge pending-uniqueness, inbox, and completion", { skip: !dbConfigured }, async () => {
  const qid = `q_engagement_${Math.random().toString(36).slice(2, 10)}`;
  const from = `u_chal_${Math.random().toString(36).slice(2, 8)}`;
  const to = `u_chal_${Math.random().toString(36).slice(2, 8)}`;
  await insertThrowawayQuestion(qid);

  try {
    // First send creates a pending row; a duplicate pending send is a no-op.
    const first = await createOgcodeChallenge(from, to, qid);
    assert.equal(first.created, true);
    const dup = await createOgcodeChallenge(from, to, qid);
    assert.equal(dup.created, false, "partial unique index blocks a second pending challenge");

    assert.equal(await countOgcodePendingChallenges(to), 1);
    const inbox = await listOgcodeChallengeInbox(to);
    assert.equal(inbox.length, 1);
    assert.equal(inbox[0].fromUserId, from);
    assert.equal(inbox[0].status, "pending");

    // Recipient's terminal outcome completes the challenge and returns the sender.
    const senders = await completeOgcodeChallengesForAttempt(to, qid, 12.5, 42);
    assert.deepEqual(senders, [{ fromUserId: from }]);
    assert.equal(await countOgcodePendingChallenges(to), 0, "no longer pending");

    const afterInbox = await listOgcodeChallengeInbox(to);
    assert.equal(afterInbox[0].status, "completed");
    assert.equal(Number(afterInbox[0].resultScore), 12.5);
    assert.equal(Number(afterInbox[0].resultTime), 42);

    // Completing again is a no-op (only pending rows are touched).
    const again = await completeOgcodeChallengesForAttempt(to, qid, 99, 1);
    assert.equal(again.length, 0);

    // A fresh challenge to the same friend+question is allowed once the prior completed.
    const reSend = await createOgcodeChallenge(from, to, qid);
    assert.equal(reSend.created, true, "re-challenge allowed after completion");
  } finally {
    await getPool().query(`DELETE FROM ogcode_friend_challenges WHERE question_id = $1`, [qid]);
    await cleanupQuestion(qid);
    await getPool().end();
    pool = null;
  }
});
