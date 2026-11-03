/**
 * Per-user store loads (perf fix: full-db-hydration-per-request). The hot
 * per-user paths used to hydrate EVERY user's rows of every app.* table under
 * one process-wide lock on each call; withUserStoreScoped / readUserStoreScoped
 * read only the acting user's rows and persist only the rows that changed.
 * Fake pool, no database.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  assertPlanFitsUserStore,
  mergeUserSliceIntoStore,
  practiceSubmitLoads,
  PRACTICE_SUBMIT_PERSIST_COLLECTIONS,
  readStoreAsync,
  readUserStoreScoped,
  withUserStoreScoped,
  type AppStore,
  type ScopedStorePersist,
} from "../../src/server/store";
import {
  buildUserCollectionQuery,
  changedRowsSinceLoad,
  hydrateUserStoreFromPostgres,
} from "../../src/server/store-postgres";
import { installFakeUserPool, userRow, writesOf } from "./_scoped-store-fakes";

const USER = "user_scoped_loader_a";
const OTHER = "user_scoped_loader_b";

/** Statements that read a whole app.* table (no user predicate): the old hydration. */
function fullTableReads(sql: string[]): string[] {
  return sql.filter((s) => /^SELECT (data|\*) FROM app\.[a-z_]+ ORDER BY/.test(s) || s === "SELECT * FROM origin_users ORDER BY joined_at ASC");
}

function activity(userId: string, date: string, extra: Record<string, unknown> = {}) {
  return { userId, date, questionsPracticed: 0, webpageTime: 0, practiceTime: 0, pomodoroTime: 0, ...extra };
}

function pointLog(userId: string, id: string, timestamp: string) {
  return { id, userId, points: 5, activityType: "consistency", description: "x", timestamp, referenceId: null };
}

// ── query builder ────────────────────────────────────────────────────────────

test("buildUserCollectionQuery: user-scoped, newest first, optional window / filter / limit", () => {
  assert.deepEqual(buildUserCollectionQuery("pointLogs", USER), {
    text: "SELECT data FROM app.point_logs WHERE user_id = $1 ORDER BY created_at DESC",
    values: [USER],
  });
  assert.deepEqual(buildUserCollectionQuery("pointLogs", USER, { limit: 10 }), {
    text: "SELECT data FROM app.point_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
    values: [USER, 10],
  });
  assert.deepEqual(
    buildUserCollectionQuery("practiceAttempts", USER, {
      createdSince: "2026-10-01T00:00:00.000Z",
      where: { field: "questionId", equals: "q_1" },
      limit: 2.7,
    }),
    {
      text:
        "SELECT data FROM app.practice_attempts WHERE user_id = $1 AND created_at >= $2" +
        " AND data->>($3::text) = $4 ORDER BY created_at DESC LIMIT $5",
      values: [USER, "2026-10-01T00:00:00.000Z", "questionId", "q_1", 2],
    },
  );
  // The filter value is a bind parameter, never spliced into the SQL.
  const hostile = buildUserCollectionQuery("pointLogs", USER, { where: { field: "referenceId", equals: "x' OR 1=1 --" } });
  assert.doesNotMatch(hostile.text, /OR 1=1/);
  assert.throws(() => buildUserCollectionQuery("pointLogs", ""), /requires a userId/);
  assert.throws(() => buildUserCollectionQuery("nope" as never, USER), /Unknown collection/);
});

test("changedRowsSinceLoad keeps new and changed rows, drops unchanged ones", () => {
  const rows = [
    ["a", USER, null, null, null, '{"v":1}'],
    ["b", USER, null, null, null, '{"v":2}'],
    ["c", USER, null, null, null, '{"v":3}'],
  ];
  const baseline = new Map([
    ["a", '{"v":1}'],
    ["b", '{"v":1}'],
  ]);
  assert.deepEqual(
    changedRowsSinceLoad(rows, baseline).map((row) => row[0]),
    ["b", "c"],
  );
  assert.equal(changedRowsSinceLoad(rows, undefined), rows, "no baseline: everything is written");
  assert.deepEqual(changedRowsSinceLoad([], baseline), []);
});

// ── loader ───────────────────────────────────────────────────────────────────

test("hydrateUserStoreFromPostgres: one user row, only the requested collections, every read user-scoped", async () => {
  const sql = installFakeUserPool({
    rowsFor: (statement) => {
      if (statement.startsWith("SELECT * FROM origin_users WHERE id = $1")) return [userRow(USER)];
      if (statement.startsWith("SELECT data FROM app.point_logs")) return [{ data: pointLog(USER, "log_1", "2026-11-01T00:00:00.000Z") }];
      return undefined;
    },
  });
  const seed = { users: [], authSessions: [{ id: "s" }], tasks: [{ id: "t" }], pointLogs: [{ id: "seed" }], streaks: [{ userId: "seed" }], questions: [{ id: "q" }] } as unknown as AppStore;
  const { store, baseline, userFound } = await hydrateUserStoreFromPostgres(seed, USER, { pointLogs: true, streaks: { limit: 1 } });

  assert.equal(userFound, true);
  assert.deepEqual(store.users.map((u) => u.id), [USER]);
  assert.deepEqual(store.authSessions, []);
  assert.deepEqual(store.tasks, []);
  assert.deepEqual(store.pointLogs.map((log) => log.id), ["log_1"]);
  assert.deepEqual(store.streaks, [], "loaded, empty for this user");
  assert.deepEqual(store.practiceAttempts, [], "not requested: empty, never another user's or seed rows");
  assert.equal(store.questions.length, 1, "static seed content stays");
  assert.deepEqual([...baseline.keys()].sort(), ["pointLogs", "streaks"]);
  assert.ok(baseline.get("pointLogs")!.has("log_1"));

  assert.deepEqual(fullTableReads(sql), []);
  assert.equal(sql.some((s) => s.includes("origin_auth_sessions")), false, "no auth-session dump");
  for (const statement of sql.filter((s) => s.startsWith("SELECT data FROM app."))) {
    assert.match(statement, /WHERE user_id = \$1/);
  }
});

test("hydrateUserStoreFromPostgres: a missing user yields an empty user list", async () => {
  installFakeUserPool();
  const seed = { users: [], authSessions: [], tasks: [], questions: [] } as unknown as AppStore;
  const { store, userFound } = await hydrateUserStoreFromPostgres(seed, USER, {});
  assert.equal(userFound, false);
  assert.deepEqual(store.users, []);
  await assert.rejects(hydrateUserStoreFromPostgres(seed, "", {}), /requires a userId/);
});

// ── plan guard ───────────────────────────────────────────────────────────────

test("assertPlanFitsUserStore refuses other users, unloaded collections, tasks, and streaks without activities", () => {
  const plan = (patch: Partial<ScopedStorePersist>): ScopedStorePersist => ({ userId: USER, collections: [], ...patch });
  assert.doesNotThrow(() => assertPlanFitsUserStore(plan({ collections: ["pointLogs"] }), USER, ["pointLogs"]));
  assert.throws(() => assertPlanFitsUserStore(plan({ userId: OTHER }), USER, []), /its own user/);
  assert.throws(() => assertPlanFitsUserStore(plan({ collections: ["userScores"] }), USER, ["pointLogs"]), /did not load: userScores/);
  assert.throws(
    () => assertPlanFitsUserStore(plan({ replaceUserRows: ["originAiReminders"] }), USER, []),
    /did not load: originAiReminders/,
  );
  assert.throws(() => assertPlanFitsUserStore(plan({ persistTasks: true }), USER, []), /tasks/);
  assert.throws(() => assertPlanFitsUserStore(plan({ collections: ["streaks"] }), USER, ["streaks"]), /dailyActivities/);
  assert.doesNotThrow(() =>
    assertPlanFitsUserStore(plan({ collections: ["streaks"] }), USER, ["streaks", "dailyActivities"]),
  );
});

test("practiceSubmitLoads covers exactly what the practice submit persists, trimmed to the one question", () => {
  const loads = practiceSubmitLoads("q_42");
  assert.deepEqual(Object.keys(loads).sort(), [...PRACTICE_SUBMIT_PERSIST_COLLECTIONS].sort());
  assert.deepEqual(loads.practiceAttempts, { where: { field: "questionId", equals: "q_42" } });
  assert.deepEqual(loads.pointLogs, { where: { field: "referenceId", equals: "q_42" } });
  assert.doesNotThrow(() =>
    assertPlanFitsUserStore(
      { userId: USER, collections: PRACTICE_SUBMIT_PERSIST_COLLECTIONS, persistUser: true },
      USER,
      Object.keys(loads) as never,
    ),
  );
});

// ── cache merge ──────────────────────────────────────────────────────────────

function cacheStore(): AppStore {
  return {
    users: [userRowAsUser(USER, 1), userRowAsUser(OTHER, 9)],
    pointLogs: [
      pointLog(OTHER, "o_1", "2026-11-02T00:00:00.000Z"),
      pointLog(USER, "u_old", "2026-11-01T00:00:00.000Z"),
      pointLog(OTHER, "o_0", "2026-10-01T00:00:00.000Z"),
    ],
    dailyActivities: [activity(USER, "2026-11-01"), activity(OTHER, "2026-11-01")],
    originAiReminders: [{ id: "r_old", userId: USER }, { id: "r_other", userId: OTHER }],
    notes: [{ id: "n_1", userId: USER }, { id: "n_2", userId: USER }, { id: "n_3", userId: OTHER }],
    tasks: [],
  } as unknown as AppStore;
}

function userRowAsUser(id: string, streak: number) {
  return { id, name: id, streak } as unknown as AppStore["users"][number];
}

test("mergeUserSliceIntoStore swaps in the user's fresh rows and leaves everyone else alone", () => {
  const target = cacheStore();
  const scoped = {
    users: [userRowAsUser(USER, 2)],
    // unshifted new log (newest first) + the existing one, updated
    pointLogs: [pointLog(USER, "u_new", "2026-11-03T00:00:00.000Z"), { ...pointLog(USER, "u_old", "2026-11-01T00:00:00.000Z"), points: 7 }],
    // existing row updated + a pushed new row
    dailyActivities: [activity(USER, "2026-11-01", { webpageTime: 60 }), activity(USER, "2026-11-03")],
    originAiReminders: [{ id: "r_new", userId: USER }],
    notes: [{ id: "n_2", userId: USER }],
  } as unknown as AppStore;
  const merged = mergeUserSliceIntoStore(target, scoped, USER, {
    userId: USER,
    collections: ["pointLogs", "dailyActivities"],
    replaceUserRows: ["originAiReminders"],
    deletions: [{ collection: "notes", id: "n_1" }],
  });

  assert.notEqual(merged, target, "a new store object, so per-store memos rebuild");
  assert.deepEqual(merged.pointLogs.map((log) => `${log.id}:${log.points}`), ["u_new:5", "o_1:5", "u_old:7", "o_0:5"]);
  assert.deepEqual(
    merged.dailyActivities.map((a) => `${a.userId}:${a.date}:${a.webpageTime}`),
    [`${USER}:2026-11-01:60`, `${OTHER}:2026-11-01:0`, `${USER}:2026-11-03:0`],
  );
  assert.deepEqual(merged.originAiReminders.map((r) => r.id), ["r_new", "r_other"], "replaced: the user's old reminder goes");
  assert.deepEqual(merged.notes.map((n) => n.id), ["n_2", "n_3"], "only the deleted note goes");
  assert.deepEqual(merged.users.map((u) => `${u.id}:${u.streak}`), [`${USER}:2`, `${OTHER}:9`]);
  // The target itself is untouched (readers holding it keep a consistent view).
  assert.equal(target.pointLogs.length, 3);
  assert.equal(target.users[0].streak, 1);
});

test("mergeUserSliceIntoStore keeps cached rows a trimmed load did not read, and adds an unknown user", () => {
  const target = cacheStore();
  const scoped = {
    users: [userRowAsUser("user_new", 0)],
    pointLogs: [pointLog("user_new", "n_1", "2026-11-03T00:00:00.000Z")],
  } as unknown as AppStore;
  const merged = mergeUserSliceIntoStore(target, scoped, "user_new", { userId: "user_new", collections: ["pointLogs"] });
  assert.deepEqual(merged.pointLogs.map((log) => log.id), ["n_1", "o_1", "u_old", "o_0"]);
  assert.deepEqual(merged.users.map((u) => u.id), [USER, OTHER, "user_new"]);

  // A trimmed load of USER's logs that saw only a new row keeps u_old.
  const trimmed = mergeUserSliceIntoStore(
    target,
    { users: [], pointLogs: [pointLog(USER, "u_new", "2026-11-03T00:00:00.000Z")] } as unknown as AppStore,
    USER,
    { userId: USER, collections: ["pointLogs"] },
  );
  assert.deepEqual(trimmed.pointLogs.map((log) => log.id), ["u_new", "o_1", "u_old", "o_0"]);
  assert.equal(trimmed.users, target.users, "no fresh user row: users untouched");
});

// ── withUserStoreScoped / readUserStoreScoped ────────────────────────────────

test("withUserStoreScoped persists only changed rows and refreshes the cached store for this user", async () => {
  const today = "2026-11-03";
  const sql = installFakeUserPool({
    rowsFor: (statement) => {
      if (statement.startsWith("SELECT * FROM origin_users WHERE id = $1")) return [userRow(USER)];
      if (statement === "SELECT * FROM origin_users ORDER BY joined_at ASC") return [userRow(USER), userRow(OTHER)];
      if (statement.startsWith("SELECT data FROM app.daily_activities")) {
        const rows = [{ data: activity(USER, today) }, { data: activity(USER, "2026-11-02") }];
        return statement.includes("user_id = $1") ? rows : [...rows, { data: activity(OTHER, today) }];
      }
      if (statement.startsWith("SELECT data FROM app.point_logs")) {
        const rows = [{ data: pointLog(USER, "log_1", "2026-11-01T00:00:00.000Z") }];
        return statement.includes("user_id = $1") ? rows : [...rows, { data: pointLog(OTHER, "log_o", "2026-11-01T00:00:00.000Z") }];
      }
      return undefined;
    },
  });
  const before = await readStoreAsync(); // whole-store cache (5-minute snapshot)
  assert.equal(before.dailyActivities.length, 3);
  sql.length = 0;

  const result = await withUserStoreScoped(
    USER,
    ["dailyActivities", "pointLogs"],
    (store) => {
      assert.deepEqual(store.users.map((u) => u.id), [USER]);
      const row = store.dailyActivities.find((a) => a.date === today)!;
      row.webpageTime += 60;
      return "ok";
    },
    { userId: USER, collections: ["dailyActivities", "pointLogs"] },
  );
  assert.equal(result, "ok");

  assert.deepEqual(fullTableReads(sql), [], "no whole-table read on the hot path");
  const writes = writesOf(sql);
  assert.equal(writes.length, 1, `exactly one upsert, got: ${writes.join(" | ")}`);
  assert.match(writes[0], /^INSERT INTO app\.daily_activities .* VALUES \(\$1,\$2,\$3,\$4,\$5,\$6::jsonb,\$7,\$8\) ON CONFLICT/);

  const after = await readStoreAsync();
  assert.notEqual(after, before);
  const mine = after.dailyActivities.find((a) => a.userId === USER && a.date === today)!;
  assert.equal(mine.webpageTime, 60);
  assert.equal(after.dailyActivities.length, 3, "other users' rows are still cached");
  assert.ok(after.pointLogs.some((log) => log.userId === OTHER));
});

test("withUserStoreScoped with nothing changed opens no transaction", async () => {
  const sql = installFakeUserPool({
    rowsFor: (statement) =>
      statement.startsWith("SELECT * FROM origin_users WHERE id = $1")
        ? [userRow(USER)]
        : statement.startsWith("SELECT data FROM app.streaks")
          ? [{ data: { userId: USER, currentStreak: 2, longestStreak: 2, lastStudyDate: "2026-11-02", weeklyData: [] } }]
          : undefined,
  });
  await withUserStoreScoped(USER, ["streaks", "dailyActivities"], () => undefined, {
    userId: USER,
    collections: ["streaks"],
  });
  assert.deepEqual(writesOf(sql), []);
  assert.equal(sql.includes("BEGIN"), false);
});

test("withUserStoreScoped refuses a plan outside its load before writing anything", async () => {
  const sql = installFakeUserPool({
    rowsFor: (statement) => (statement.startsWith("SELECT * FROM origin_users WHERE id = $1") ? [userRow(USER)] : undefined),
  });
  await assert.rejects(
    withUserStoreScoped(
      USER,
      ["pointLogs"],
      (store) => {
        store.userScores.push({ userId: USER, totalPoints: 0, currentTier: "x", lastUpdated: "" } as never);
      },
      { userId: USER, collections: ["userScores"] },
    ),
    /did not load: userScores/,
  );
  assert.deepEqual(writesOf(sql), []);
});

test("withUserStoreScoped runs one user's calls in order", async () => {
  installFakeUserPool({
    rowsFor: (statement) => (statement.startsWith("SELECT * FROM origin_users WHERE id = $1") ? [userRow(USER)] : undefined),
  });
  const events: string[] = [];
  let releaseFirst!: () => void;
  const gate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const first = withUserStoreScoped(USER, [], async () => {
    events.push("first:start");
    await gate;
    events.push("first:end");
  }, null);
  const second = withUserStoreScoped(USER, [], () => {
    events.push("second");
  }, null);
  const other = withUserStoreScoped(OTHER, [], () => {
    events.push("other");
  }, null);
  await other;
  releaseFirst();
  await Promise.all([first, second]);
  assert.ok(events.indexOf("second") > events.indexOf("first:end"), "same user waits its turn");
  assert.ok(events.indexOf("other") < events.indexOf("first:end"), "another user is not held up");
});

test("readUserStoreScoped reads without a transaction and honours trimmed loads", async () => {
  const seen: Array<{ sql: string; values?: unknown[] }> = [];
  const sql = installFakeUserPool({
    onQuery: (statement, values) => seen.push({ sql: statement, values }),
    rowsFor: (statement) => (statement.startsWith("SELECT * FROM origin_users WHERE id = $1") ? [userRow(USER)] : undefined),
  });
  const ids = await readUserStoreScoped(USER, { pointLogs: { limit: 10 } }, (store) => store.users.map((u) => u.id));
  assert.deepEqual(ids, [USER]);
  assert.equal(sql.includes("BEGIN"), false);
  const logs = seen.find((entry) => entry.sql.startsWith("SELECT data FROM app.point_logs"))!;
  assert.deepEqual(logs.values, [USER, 10]);
});
