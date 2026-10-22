/**
 * Bug-hunt 10 / N3 — src/legacy/users.ts handlers persist ONLY the acting
 * user's mutated collections (fake pool; no database needed). The old
 * withStoreAsync path issued `DELETE FROM app.<every table>` +
 * `DELETE FROM origin_auth_sessions` on each call.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { handleUsersRequest } from "../../src/server/users";
import {
  appTablesWritten,
  assertNoUnscopedDelete,
  authedRequest,
  installFakeUserPool,
  userRow,
  usersOnly,
  writesOf,
} from "./_scoped-store-fakes";

const USER = "user_scoped_users_a";

function setup(extraRows?: (sql: string) => unknown[] | undefined, failFor?: (sql: string) => boolean) {
  const users = usersOnly([userRow(USER)]);
  return installFakeUserPool({
    rowsFor: (sql) => extraRows?.(sql) ?? users(sql),
    failFor,
  });
}

test("pomodoro create (completed on create): server-timed to 0 s, so it earns nothing and writes only app.pomodoro_sessions", async () => {
  // Bug N4 (fix/points-idempotency): a session created already-complete has
  // lasted 0 s as far as the server knows, so the client's 25 min is ignored.
  const sql = setup();
  const request = await authedRequest(USER, "http://localhost/api/users/pomodoro", { method: "POST" });
  const response = await handleUsersRequest("POST", ["pomodoro"], request, {
    mode: "focus",
    duration: 25 * 60,
    is_completed: true,
  });
  assert.equal(response.status, 201);

  assertNoUnscopedDelete(sql);
  assert.deepEqual(appTablesWritten(sql), ["app.pomodoro_sessions"]);
  assert.equal(writesOf(sql).some((s) => s.startsWith("UPDATE origin_users")), false, "no streak column write");
  assert.equal(sql.some((s) => s.startsWith("INSERT INTO origin_users")), false, "no whole-row user upsert");
});

test("pomodoro update completing a 25-min session: award claim + pomodoro + points + streak rows and the streak column only", async () => {
  const SESSION = "pomodoro_scoped_a";
  const users = usersOnly([userRow(USER)]);
  const sql = setup((statement) => {
    if (statement.startsWith("SELECT data FROM app.pomodoro_sessions")) {
      return [
        {
          data: {
            id: SESSION,
            userId: USER,
            startTime: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
            endTime: null,
            duration: 0,
            mode: "focus",
            breakReason: null,
            interruptionCount: 0,
            isCompleted: false,
          },
        },
      ];
    }
    if (statement.startsWith("INSERT INTO app.point_awards")) {
      return [{ user_id: USER, award_key: `pomodoro:${SESSION}`, points: 20, reference_id: SESSION }];
    }
    return users(statement);
  });
  const request = await authedRequest(USER, `http://localhost/api/users/pomodoro/${SESSION}`, { method: "PATCH" });
  const response = await handleUsersRequest("PATCH", ["pomodoro", SESSION], request, { is_completed: true });
  assert.equal(response.status, 200);

  assertNoUnscopedDelete(sql);
  assert.deepEqual(appTablesWritten(sql), [
    "app.point_awards",
    "app.point_logs",
    "app.pomodoro_sessions",
    "app.streaks",
    "app.user_scores",
  ]);
  const userUpdates = writesOf(sql).filter((s) => s.startsWith("UPDATE origin_users"));
  assert.deepEqual(userUpdates, ["UPDATE origin_users SET streak = $1 WHERE id = $2"], "streak column only");
  assert.equal(sql.some((s) => s.startsWith("INSERT INTO origin_users")), false, "no whole-row user upsert");
});

test("pomodoro create (not completed): only app.pomodoro_sessions", async () => {
  const sql = setup();
  const request = await authedRequest(USER, "http://localhost/api/users/pomodoro", { method: "POST" });
  const response = await handleUsersRequest("POST", ["pomodoro"], request, { mode: "focus", duration: 60 });
  assert.equal(response.status, 201);
  assertNoUnscopedDelete(sql);
  assert.deepEqual(appTablesWritten(sql), ["app.pomodoro_sessions"]);
});

test("time post (first entry of the day, with subject): activity + subject + points + streak rows", async () => {
  const sql = setup();
  const request = await authedRequest(USER, "http://localhost/api/users/time", { method: "POST" });
  const response = await handleUsersRequest("POST", ["time"], request, {
    time_type: "practice",
    time_spent: 120,
    subject: "physics",
  });
  assert.equal(response.status, 200);
  assertNoUnscopedDelete(sql);
  assert.deepEqual(appTablesWritten(sql), [
    "app.daily_activities",
    "app.daily_subject_activities",
    "app.point_logs",
    "app.streaks",
    "app.user_scores",
  ]);
});

test("profile PATCH: a targeted UPDATE of the changed columns, no store rewrite", async () => {
  const sql = setup();
  const request = await authedRequest(USER, "http://localhost/api/users/me", { method: "PATCH" });
  const response = await handleUsersRequest("PATCH", ["me"], request, { name: "Renamed", isDropper: true });
  assert.equal(response.status, 200);
  assertNoUnscopedDelete(sql);
  assert.deepEqual(appTablesWritten(sql), []);
  assert.deepEqual(writesOf(sql), ["UPDATE origin_users SET name = $1, is_dropper = $2 WHERE id = $3"]);
  assert.equal(sql.includes("BEGIN"), false, "no store transaction at all");
});

test("reads (points, stats, pomodoro list, pomodoro detail) write nothing", async () => {
  for (const [method, slug] of [
    ["GET", ["points"]],
    ["GET", ["stats"]],
    ["GET", ["pomodoro"]],
    ["GET", ["pomodoro", "missing"]],
  ] as const) {
    const sql = setup();
    const request = await authedRequest(USER, `http://localhost/api/users/${slug.join("/")}`);
    await handleUsersRequest(method, [...slug], request, {});
    assert.deepEqual(writesOf(sql), [], `${slug.join("/")} wrote: ${writesOf(sql).join(" | ")}`);
  }
});

test("unauthenticated write handler writes nothing", async () => {
  const sql = setup();
  const response = await handleUsersRequest(
    "POST",
    ["pomodoro"],
    new Request("http://localhost/api/users/pomodoro", { method: "POST" }),
    { mode: "focus", duration: 60 },
  );
  assert.equal(response.status, 401);
  assert.deepEqual(writesOf(sql), []);
});

test("task delete store fallback (targeted writer failed): user-scoped row delete, never DELETE FROM app.tasks", async () => {
  const taskRow = {
    id: "task_scoped_1",
    user_id: USER,
    text: "revise",
    completed: false,
    due: "2026-10-30",
    created_at: new Date("2026-10-01T00:00:00Z"),
  };
  const users = usersOnly([userRow(USER)]);
  const sql = setup(
    (s) => (s.startsWith("SELECT * FROM app.tasks ORDER BY") ? [taskRow] : users(s)),
    // dbDeleteTask's own statement fails → the handler falls back to the store.
    (s) => s === "DELETE FROM app.tasks WHERE id = $1 AND user_id = $2",
  );
  const request = await authedRequest(USER, "http://localhost/api/users/tasks/task_scoped_1", { method: "DELETE" });
  const response = await handleUsersRequest("DELETE", ["tasks", "task_scoped_1"], request, {});
  assert.equal(response.status, 204);
  assertNoUnscopedDelete(sql);
  assert.ok(sql.includes("DELETE FROM app.tasks WHERE user_id = $1 AND id = $2"), "targeted task delete");
  assert.equal(sql.includes("DELETE FROM app.tasks"), false, "no whole-table task delete");
});

test("task create store fallback: upserts only this user's tasks", async () => {
  const otherTask = {
    id: "task_other",
    user_id: "user_someone_else",
    text: "theirs",
    completed: false,
    due: "2026-10-30",
    created_at: new Date("2026-10-01T00:00:00Z"),
  };
  const users = usersOnly([userRow(USER)]);
  const inserted: string[] = [];
  const sql = installFakeUserPool({
    rowsFor: (s) => (s.startsWith("SELECT * FROM app.tasks ORDER BY") ? [otherTask] : users(s)),
    failFor: (s) => s.startsWith("INSERT INTO app.tasks (id, user_id, text, completed, due, created_at, updated_at, category, priority, data) VALUES ($1,$2,$3,$4,$5,$6,$6"),
  });
  const request = await authedRequest(USER, "http://localhost/api/users/tasks", { method: "POST" });
  const response = await handleUsersRequest("POST", ["tasks"], request, { text: "mine", due: "2026-11-01" });
  assert.equal(response.status, 201);
  assertNoUnscopedDelete(sql);
  for (const s of sql) if (s.startsWith("INSERT INTO app.tasks (")) inserted.push(s);
  // One failed targeted insert + exactly one scoped upsert (this user's single task).
  assert.equal(inserted.length, 2);
  assert.equal(appTablesWritten(sql).join(","), "app.tasks");
});
