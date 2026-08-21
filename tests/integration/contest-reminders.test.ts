/**
 * DB-backed test for the reminder send-once claim (Phase 2b). Verifies that
 * sendContestReminder claims each registered user exactly once per kind (so a
 * cron re-fire never double-sends) and that a second call is a no-op.
 *
 * Skips when USER_DATABASE_URL is not configured. Notifications/push/email
 * senders no-op without their own config, so this exercises the CLAIM ledger,
 * which is the idempotency contract.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { dbConfigured, makeId, rawPool } from "./_db";
import { sendContestReminder } from "@/server/contest/contest-reminders-service";

const maybe = dbConfigured() ? test : test.skip;

maybe("reminder is claimed and sent exactly once per user per kind", async () => {
  const pool = rawPool();
  const contestId = makeId("contest_rem");
  const users = [makeId("u_rem_a"), makeId("u_rem_b"), makeId("u_rem_c")];

  try {
    await pool.query(
      `INSERT INTO contest.contests (id, name, status) VALUES ($1, 'Rem Contest', 'scheduled')`,
      [contestId],
    );
    for (const u of users) {
      await pool.query(
        `INSERT INTO origin_users (id, name, email, role, password_hash)
           VALUES ($1, 'Rem', $2, 'student', 'x') ON CONFLICT (id) DO NOTHING`,
        [u, `${u}@test.local`],
      );
      await pool.query(
        `INSERT INTO contest.registrations (contest_id, user_id) VALUES ($1, $2)`,
        [contestId, u],
      );
    }

    // first send → all 3 claimed
    const sent1 = await sendContestReminder(contestId, "Rem Contest", "t_1h");
    assert.equal(sent1, 3, "all 3 registered users get the reminder");

    // ledger has exactly 3 rows for this kind
    const ledger = await pool.query(
      `SELECT COUNT(*)::int AS n FROM contest.reminders_sent WHERE contest_id=$1 AND reminder_kind='t_1h'`,
      [contestId],
    );
    assert.equal(ledger.rows[0].n, 3);

    // second send → no-op (already claimed)
    const sent2 = await sendContestReminder(contestId, "Rem Contest", "t_1h");
    assert.equal(sent2, 0, "re-fire sends nothing");

    // a DIFFERENT kind is independent
    const sent3 = await sendContestReminder(contestId, "Rem Contest", "t_10m");
    assert.equal(sent3, 3, "a different reminder kind fans out to all 3");

    // a newly-registered user gets the still-pending t_1h on the next tick
    const late = makeId("u_rem_late");
    await pool.query(
      `INSERT INTO origin_users (id, name, email, role, password_hash)
         VALUES ($1, 'Late', $2, 'student', 'x') ON CONFLICT (id) DO NOTHING`,
      [late, `${late}@test.local`],
    );
    await pool.query(`INSERT INTO contest.registrations (contest_id, user_id) VALUES ($1, $2)`, [contestId, late]);
    users.push(late);
    const sent4 = await sendContestReminder(contestId, "Rem Contest", "t_1h");
    assert.equal(sent4, 1, "only the newly-registered user gets t_1h");
  } finally {
    await pool.query(`DELETE FROM contest.reminders_sent WHERE contest_id = $1`, [contestId]);
    await pool.query(`DELETE FROM contest.registrations WHERE contest_id = $1`, [contestId]);
    await pool.query(`DELETE FROM contest.contests WHERE id = $1`, [contestId]);
    await pool.query(`DELETE FROM origin_users WHERE id = ANY($1::text[])`, [users]);
  }
});
