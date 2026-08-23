/**
 * DB-backed test for recurring auto-scheduling: a schedule whose registration
 * window has opened gets a published contest created by runDueSchedules, and the
 * schedule advances by its cadence (idempotent — a second run creates nothing).
 * Skips when USER_DATABASE_URL is not configured.
 */

import test from "node:test";
import assert from "node:assert/strict";

process.env.TEACHER_LAUNCH_CONTEST = "1";

import { dbConfigured, makeId, rawPool } from "./_db";
import { createSchedule, runDueSchedules, getSchedule } from "@/server/contest/contest-schedule-service";

const maybe = dbConfigured() ? test : test.skip;
const CHAPTER = "SchedTestChapter";

maybe("runDueSchedules creates + publishes the due occurrence and advances the schedule", async () => {
  const pool = rawPool();
  const adminId = makeId("sched_admin");
  const qIds = [makeId("sq1"), makeId("sq2"), makeId("sq3")];
  try {
    await pool.query(
      `INSERT INTO origin_users (id, name, email, role, password_hash)
         VALUES ($1, 'A', $2, 'admin', 'x') ON CONFLICT (id) DO NOTHING`,
      [adminId, `${adminId}@test.local`],
    );
    // seed a small physics MCQ pool
    for (let i = 0; i < qIds.length; i++) {
      await pool.query(
        `INSERT INTO ogcode_questions
           (id, source_index, text, explanation, subject, chapter, concept, difficulty, question_type, options, correct_option, class)
         VALUES ($1, $2, 'Q', '', 'physics', $3, 'C', 'medium', 'mcq', $4::jsonb, 1, 11)
         ON CONFLICT (id) DO NOTHING`,
        [qIds[i], 970000 + i, CHAPTER, JSON.stringify(["A", "B", "C", "D"])],
      );
    }

    // Schedule: first start in ~1 day, reg opens 5 days before → registration
    // window is ALREADY open now, so it's due.
    const firstStart = new Date(Date.now() + 1 * 86_400_000).toISOString();
    const sched = await createSchedule(adminId, {
      name: "Auto Weekly",
      subjects: ["Physics"],
      topics: { Physics: [CHAPTER] },
      selections: [{ subject: "Physics", count: 2, topics: [CHAPTER] }],
      durationMinutes: 60,
      regLeadDays: 5,
      cadenceDays: 7,
      firstStartAt: firstStart,
    });

    // ── run the cron ──
    const r1 = await runDueSchedules();
    assert.equal(r1.created.length >= 1, true, "an occurrence was created");
    const contestId = r1.created.find(Boolean)!;

    // the created contest is published (scheduled) with a frozen paper
    const c = await pool.query(`SELECT status, start_at, end_at FROM contest.contests WHERE id = $1`, [contestId]);
    assert.equal(c.rows[0].status, "scheduled", "auto-published → scheduled");
    const qCount = await pool.query(`SELECT COUNT(*)::int AS n FROM contest.contest_questions WHERE contest_id = $1`, [contestId]);
    assert.equal(qCount.rows[0].n, 2, "2 questions frozen from the selection");

    // schedule advanced: run_count=1, next_start_at = firstStart + 7d
    const after = await getSchedule(sched.id);
    assert.equal(after?.runCount, 1);
    assert.equal(
      new Date(after!.nextStartAt).getTime(),
      new Date(firstStart).getTime() + 7 * 86_400_000,
      "next_start_at advanced by cadence",
    );

    // ── idempotent: a second run creates nothing more (next occurrence not due) ──
    const r2 = await runDueSchedules();
    assert.ok(!r2.created.includes(contestId), "no duplicate creation");
    const after2 = await getSchedule(sched.id);
    assert.equal(after2?.runCount, 1, "run_count unchanged on re-run");
  } finally {
    // clean up any contests the schedule created
    const made = await pool.query(`SELECT id FROM contest.contests WHERE name LIKE 'Auto Weekly%'`);
    for (const row of made.rows) {
      await pool.query(`DELETE FROM contest.contest_questions WHERE contest_id = $1`, [row.id]);
      await pool.query(`DELETE FROM contest.contests WHERE id = $1`, [row.id]);
    }
    await pool.query(`DELETE FROM contest.schedules WHERE created_by = $1`, [adminId]);
    await pool.query(`DELETE FROM ogcode_questions WHERE chapter = $1`, [CHAPTER]);
    await pool.query(`DELETE FROM origin_users WHERE id = $1`, [adminId]);
  }
});
