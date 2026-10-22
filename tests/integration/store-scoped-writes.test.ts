/**
 * DB-backed integration test for bug-hunt 10 / N3: a scoped notes save must not
 * delete a concurrently-written row of ANOTHER user.
 *
 * Simulates the cross-instance race: the scoped call hydrates its store
 * snapshot, then (inside `mutate`, i.e. after the snapshot was taken) "another
 * instance" inserts user B's practice attempt directly in Postgres, then user A
 * saves a note. The old full-store persist would `DELETE FROM
 * app.practice_attempts` and re-insert the stale snapshot, erasing B's attempt;
 * the scoped persist must leave it alone.
 *
 * Also covers the follow-up primitives (user-scoped Ori reminder replace,
 * targeted task delete/upsert) and one users.ts handler end to end.
 *
 * Skips when USER_DATABASE_URL is not configured.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { dbConfigured, makeId, rawPool } from "./_db";
import {
  createId,
  ScopedWritePlan,
  withStoreAsyncScoped,
  type StoredNote,
} from "@/server/store";
import { ensureAppStoreSchema } from "@/server/store-postgres";
import { handleUsersRequest } from "@/server/users";
import { authedRequest } from "../unit/_scoped-store-fakes";

const maybe = dbConfigured() ? test : test.skip;

maybe("scoped notes save does not delete another user's practice attempt", async () => {
  await ensureAppStoreSchema();
  const pool = rawPool();
  const userA = makeId("user_scoped_a");
  const userB = makeId("user_scoped_b");
  const attemptId = makeId("attempt_scoped_b");
  const noteId = createId("note");

  try {
    for (const id of [userA, userB]) {
      await pool.query(
        `INSERT INTO origin_users (id, name, email, role, password_hash)
           VALUES ($1, 'Scoped User', $2, 'student', 'x') ON CONFLICT (id) DO NOTHING`,
        [id, `${id}@test.local`],
      );
    }

    const plan = new ScopedWritePlan();
    await withStoreAsyncScoped(async (store) => {
      // Another instance writes B's attempt AFTER this snapshot was hydrated.
      await pool.query(
        `INSERT INTO app.practice_attempts (id, user_id, data, created_at, updated_at)
           VALUES ($1, $2, $3::jsonb, NOW(), NOW())`,
        [attemptId, userB, JSON.stringify({ id: attemptId, userId: userB, questionId: "q1", isCorrect: true })],
      );
      assert.equal(
        store.practiceAttempts.some((attempt) => attempt.id === attemptId),
        false,
        "the snapshot predates B's attempt",
      );
      const now = new Date().toISOString();
      const note: StoredNote = {
        id: noteId, userId: userA, bookId: "book_1", chapterId: null, pageNumber: null,
        content: "scoped", color: "#FEF3C7", createdAt: now, updatedAt: now, tags: [],
      };
      store.notes.unshift(note);
      plan.forUser(userA).touch("notes");
    }, plan.toPersist);

    const attempt = await pool.query(`SELECT 1 FROM app.practice_attempts WHERE id = $1`, [attemptId]);
    assert.equal(attempt.rowCount, 1, "B's concurrent practice attempt survived A's note save");
    const saved = await pool.query(`SELECT user_id FROM app.notes WHERE id = $1`, [noteId]);
    assert.equal(saved.rows[0]?.user_id, userA, "A's note was persisted");

    // Targeted delete removes only A's note, nothing else.
    const deletePlan = new ScopedWritePlan();
    await withStoreAsyncScoped((store) => {
      store.notes = store.notes.filter((entry) => entry.id !== noteId);
      deletePlan.forUser(userA).remove("notes", noteId);
    }, deletePlan.toPersist);
    const gone = await pool.query(`SELECT 1 FROM app.notes WHERE id = $1`, [noteId]);
    assert.equal(gone.rowCount, 0);
    const still = await pool.query(`SELECT 1 FROM app.practice_attempts WHERE id = $1`, [attemptId]);
    assert.equal(still.rowCount, 1);
  } finally {
    await pool.query(`DELETE FROM app.notes WHERE id = $1`, [noteId]);
    await pool.query(`DELETE FROM app.practice_attempts WHERE id = $1`, [attemptId]);
    await pool.query(`DELETE FROM origin_users WHERE id = ANY($1)`, [[userA, userB]]);
  }
});

async function insertUsers(ids: string[]): Promise<void> {
  const pool = rawPool();
  for (const id of ids) {
    await pool.query(
      `INSERT INTO origin_users (id, name, email, role, password_hash)
         VALUES ($1, 'Scoped User', $2, 'student', 'x') ON CONFLICT (id) DO NOTHING`,
      [id, `${id}@test.local`],
    );
  }
}

async function insertPracticeAttempt(attemptId: string, userId: string): Promise<void> {
  await rawPool().query(
    `INSERT INTO app.practice_attempts (id, user_id, data, created_at, updated_at)
       VALUES ($1, $2, $3::jsonb, NOW(), NOW())`,
    [attemptId, userId, JSON.stringify({ id: attemptId, userId, questionId: "q1", isCorrect: true })],
  );
}

maybe("scoped Ori reminder replace clears only this user's reminders and spares concurrent writes", async () => {
  await ensureAppStoreSchema();
  const pool = rawPool();
  const userA = makeId("user_scoped_rem_a");
  const userB = makeId("user_scoped_rem_b");
  const staleA = makeId("rem_stale_a");
  const newA = makeId("rem_new_a");
  const reminderB = makeId("rem_b");
  const attemptB = makeId("attempt_rem_b");
  const reminder = (id: string, userId: string) => ({
    id, userId, title: "t", description: "d", kind: "habit", priority: "low", createdAt: new Date().toISOString(),
  });

  try {
    await insertUsers([userA, userB]);
    for (const [id, userId] of [[staleA, userA], [reminderB, userB]]) {
      await pool.query(
        `INSERT INTO app.origin_ai_reminders (id, user_id, data, created_at, updated_at)
           VALUES ($1, $2, $3::jsonb, NOW(), NOW())`,
        [id, userId, JSON.stringify(reminder(id, userId))],
      );
    }

    const plan = new ScopedWritePlan();
    await withStoreAsyncScoped(async (store) => {
      await insertPracticeAttempt(attemptB, userB); // another instance, after the snapshot
      store.originAiReminders = [
        ...store.originAiReminders.filter((entry) => entry.userId !== userA),
        reminder(newA, userA) as unknown as (typeof store.originAiReminders)[number],
      ];
      plan.forUser(userA).replaceAll("originAiReminders");
    }, plan.toPersist);

    const rows = await pool.query(
      `SELECT id, user_id FROM app.origin_ai_reminders WHERE id = ANY($1) ORDER BY id`,
      [[staleA, newA, reminderB]],
    );
    const ids = rows.rows.map((row) => row.id as string);
    assert.equal(ids.includes(staleA), false, "A's stale reminder cleared");
    assert.equal(ids.includes(newA), true, "A's rebuilt reminder upserted");
    assert.equal(ids.includes(reminderB), true, "B's reminder untouched");
    const attempt = await pool.query(`SELECT 1 FROM app.practice_attempts WHERE id = $1`, [attemptB]);
    assert.equal(attempt.rowCount, 1, "B's concurrent practice attempt survived");
  } finally {
    await pool.query(`DELETE FROM app.origin_ai_reminders WHERE id = ANY($1)`, [[staleA, newA, reminderB]]);
    await pool.query(`DELETE FROM app.practice_attempts WHERE id = $1`, [attemptB]);
    await pool.query(`DELETE FROM origin_users WHERE id = ANY($1)`, [[userA, userB]]);
  }
});

maybe("scoped task delete + upsert never touches another user's concurrently-written task", async () => {
  await ensureAppStoreSchema();
  const pool = rawPool();
  const userA = makeId("user_scoped_task_a");
  const userB = makeId("user_scoped_task_b");
  const taskA1 = makeId("task_a1");
  const taskA2 = makeId("task_a2");
  const taskB = makeId("task_b");
  const insertTask = (id: string, userId: string) =>
    pool.query(
      `INSERT INTO app.tasks (id, user_id, text, completed, due, created_at, updated_at, data)
         VALUES ($1, $2, 'task', FALSE, '2026-11-01', NOW(), NOW(), '{}'::jsonb)`,
      [id, userId],
    );

  try {
    await insertUsers([userA, userB]);
    await insertTask(taskA1, userA);

    const plan = new ScopedWritePlan();
    await withStoreAsyncScoped(async (store) => {
      await insertTask(taskB, userB); // another instance, after the snapshot
      store.tasks = store.tasks.filter((task) => task.id !== taskA1);
      store.tasks.push({
        id: taskA2, userId: userA, text: "new", completed: false, due: "2026-11-02", createdAt: new Date().toISOString(),
      });
      plan.forUser(userA).remove("tasks", taskA1).touchTasks();
    }, plan.toPersist);

    const rows = await pool.query(`SELECT id FROM app.tasks WHERE id = ANY($1)`, [[taskA1, taskA2, taskB]]);
    const ids = rows.rows.map((row) => row.id as string).sort();
    assert.deepEqual(ids, [taskA2, taskB].sort(), "A1 deleted, A2 upserted, B's concurrent task kept");
  } finally {
    await pool.query(`DELETE FROM app.tasks WHERE id = ANY($1)`, [[taskA1, taskA2, taskB]]);
    await pool.query(`DELETE FROM origin_users WHERE id = ANY($1)`, [[userA, userB]]);
  }
});

maybe("users.ts pomodoro create persists the scoped rows + streak column on a real database", async () => {
  await ensureAppStoreSchema();
  const pool = rawPool();
  const userA = makeId("user_scoped_pomo_a");
  const userB = makeId("user_scoped_pomo_b");
  const attemptB = makeId("attempt_pomo_b");

  try {
    await insertUsers([userA, userB]);
    await insertPracticeAttempt(attemptB, userB);
    const request = await authedRequest(userA, "http://localhost/api/users/pomodoro", { method: "POST" });
    const response = await handleUsersRequest("POST", ["pomodoro"], request, {
      mode: "focus",
      duration: 25 * 60,
      is_completed: true,
    });
    assert.equal(response.status, 201);

    const sessions = await pool.query(`SELECT 1 FROM app.pomodoro_sessions WHERE user_id = $1`, [userA]);
    assert.equal(sessions.rowCount, 1, "pomodoro session persisted");
    const logs = await pool.query(`SELECT 1 FROM app.point_logs WHERE user_id = $1 AND data->>'activityType' = 'pomodoro'`, [userA]);
    assert.equal(logs.rowCount, 1, "pomodoro points logged");
    const user = await pool.query(`SELECT streak FROM origin_users WHERE id = $1`, [userA]);
    assert.ok(Number(user.rows[0]?.streak) >= 1, "streak column written by the targeted update");
    const attempt = await pool.query(`SELECT 1 FROM app.practice_attempts WHERE id = $1`, [attemptB]);
    assert.equal(attempt.rowCount, 1, "B's practice attempt untouched");
  } finally {
    for (const table of ["pomodoro_sessions", "point_logs", "user_scores", "streaks"]) {
      await pool.query(`DELETE FROM app.${table} WHERE user_id = $1`, [userA]);
    }
    await pool.query(`DELETE FROM app.practice_attempts WHERE id = $1`, [attemptB]);
    await pool.query(`DELETE FROM origin_users WHERE id = ANY($1)`, [[userA, userB]]);
  }
});
