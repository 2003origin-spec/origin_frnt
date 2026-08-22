/**
 * DB-backed test for public contest share links: opt-in mint (idempotent),
 * sanitized public read (no PII/answers), gating (published + participant), and
 * revocation. Skips when USER_DATABASE_URL is not configured.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { dbConfigured, makeId, rawPool } from "./_db";
import {
  getOrCreateShareSlug,
  revokeShareSlug,
  getPublicShareCard,
} from "@/server/contest/contest-share-service";

const maybe = dbConfigured() ? test : test.skip;

maybe("share link: opt-in mint, sanitized public read, revoke", async () => {
  const pool = rawPool();
  const contestId = makeId("contest_share");
  const userId = makeId("u_share");
  try {
    await pool.query(
      `INSERT INTO origin_users (id, name, email, role, password_hash)
         VALUES ($1, 'Aarav Sharma', $2, 'student', 'x') ON CONFLICT (id) DO NOTHING`,
      [userId, `${userId}@test.local`],
    );
    // published contest + a finished attempt + a leaderboard row
    await pool.query(`INSERT INTO contest.contests (id, name, status) VALUES ($1, 'Origin Weekly Share', 'result_published')`, [contestId]);
    await pool.query(
      `INSERT INTO contest.attempts (contest_id, user_id, started_at, finished_at, score, correct_count, incorrect_count, unattempted_count)
       VALUES ($1, $2, NOW(), NOW(), 120, 12, 3, 0)`,
      [contestId, userId],
    );
    await pool.query(
      `INSERT INTO contest.leaderboard_snapshot (contest_id, rank, user_id, score, percentile)
       VALUES ($1, 7, $2, 120, 94)`,
      [contestId, userId],
    );

    // mint (idempotent — same slug on re-share)
    const slug1 = await getOrCreateShareSlug(contestId, userId);
    const slug2 = await getOrCreateShareSlug(contestId, userId);
    assert.equal(slug1, slug2, "re-share reuses the slug");
    assert.ok(slug1.length >= 12, "slug is unguessably long");

    // sanitized public read — FIRST NAME ONLY, rank/percentile/score, no PII
    const card = await getPublicShareCard(slug1);
    assert.ok(card);
    assert.equal(card!.displayName, "Aarav", "first name only (no surname)");
    assert.equal(card!.rank, 7);
    assert.equal(card!.percentile, 94);
    assert.equal(card!.score, 120);
    // the sanitized shape carries no email/user id/answers
    assert.ok(!("email" in (card as object)) && !("userId" in (card as object)));

    // unknown slug → null
    assert.equal(await getPublicShareCard("does-not-exist"), null);

    // revoke → public read 404s (null)
    await revokeShareSlug(contestId, userId);
    assert.equal(await getPublicShareCard(slug1), null, "revoked slug is not readable");
    // re-share un-revokes and returns the same slug
    const slug3 = await getOrCreateShareSlug(contestId, userId);
    assert.equal(slug3, slug1);
    assert.ok(await getPublicShareCard(slug1), "re-shared slug is readable again");
  } finally {
    await pool.query(`DELETE FROM contest.share_links WHERE contest_id = $1`, [contestId]);
    await pool.query(`DELETE FROM contest.leaderboard_snapshot WHERE contest_id = $1`, [contestId]);
    await pool.query(`DELETE FROM contest.attempts WHERE contest_id = $1`, [contestId]);
    await pool.query(`DELETE FROM contest.contests WHERE id = $1`, [contestId]);
    await pool.query(`DELETE FROM origin_users WHERE id = $1`, [userId]);
  }
});

maybe("share link: gated — unpublished or non-participant cannot mint", async () => {
  const pool = rawPool();
  const contestId = makeId("contest_share_gate");
  const userId = makeId("u_share_gate");
  try {
    await pool.query(
      `INSERT INTO origin_users (id, name, email, role, password_hash)
         VALUES ($1, 'B', $2, 'student', 'x') ON CONFLICT (id) DO NOTHING`,
      [userId, `${userId}@test.local`],
    );
    // scheduled (not published) → mint refused
    await pool.query(`INSERT INTO contest.contests (id, name, status) VALUES ($1, 'Sched', 'scheduled')`, [contestId]);
    await assert.rejects(() => getOrCreateShareSlug(contestId, userId), /not published/i);

    // published but no finished attempt → refused
    await pool.query(`UPDATE contest.contests SET status = 'result_published' WHERE id = $1`, [contestId]);
    await assert.rejects(() => getOrCreateShareSlug(contestId, userId), /participants/i);
  } finally {
    await pool.query(`DELETE FROM contest.share_links WHERE contest_id = $1`, [contestId]);
    await pool.query(`DELETE FROM contest.contests WHERE id = $1`, [contestId]);
    await pool.query(`DELETE FROM origin_users WHERE id = $1`, [userId]);
  }
});
