/**
 * The hot per-user handlers moved off the whole-store hydration
 * (full-db-hydration-per-request, stale-store-auth-new-users): POST
 * /api/users/time, GET /api/users/{me,stats,points,pomodoro}, the login streak
 * touch and the cached-store auth helper. Fake pool, no database.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { handleUsersRequest } from "../../src/server/users";
import { recordDailyLoginStreak } from "../../src/server/streak-login";
import { withFreshUserInStore } from "../../src/server/auth";
import { homeStoreLoads } from "../../src/server/mobile/app-api";
import { globalRankingForOneUser } from "../../src/legacy/users";
import { GLOBAL_SOLVED_RANK_SQL } from "../../src/server/store-postgres";
import { istDateKey } from "../../src/lib/ist-day";
import type { AppStore } from "../../src/server/store";
import { appTablesWritten, authedRequest, installFakeUserPool, userRow, writesOf } from "./_scoped-store-fakes";

const USER = "user_scoped_handlers_a";

function normalized(sql: string): string {
  return sql.replace(/\s+/g, " ").trim();
}

/** Whole-table reads: what every one of these calls used to do. */
function fullTableReads(sql: string[]): string[] {
  return sql.filter(
    (s) =>
      /^SELECT (data|\*) FROM app\.[a-z_]+ ORDER BY/.test(s) ||
      s === "SELECT * FROM origin_users ORDER BY joined_at ASC" ||
      s.includes("FROM origin_auth_sessions WHERE refresh_token_expires_at"),
  );
}

function activity(date: string) {
  return { userId: USER, date, questionsPracticed: 0, webpageTime: 0, practiceTime: 0, pomodoroTime: 0 };
}

type Rows = Record<string, unknown[]>;

/** Rows by statement prefix, plus the caller's origin_users row. */
function setup(rows: Rows = {}) {
  return installFakeUserPool({
    rowsFor: (sql) => {
      if (sql.startsWith("SELECT * FROM origin_users WHERE id = $1")) return [userRow(USER)];
      for (const [prefix, value] of Object.entries(rows)) {
        if (sql.startsWith(prefix)) return value;
      }
      return undefined;
    },
  });
}

test("time ping (today already recorded): loads only today's-activity collections and writes one row", async () => {
  const today = istDateKey();
  const sql = setup({
    "SELECT 1 FROM app.daily_activities": [{ "?column?": 1 }],
    "SELECT data FROM app.daily_activities": [{ data: activity(today) }],
  });
  const request = await authedRequest(USER, "http://localhost/api/users/time", { method: "POST" });
  const response = await handleUsersRequest("POST", ["time"], request, { time_type: "webpage", time_spent: 60 });
  assert.equal(response.status, 200);

  assert.deepEqual(fullTableReads(sql), []);
  assert.equal(sql.some((s) => s.startsWith("SELECT data FROM app.point_logs")), false, "no point-log load");
  assert.equal(sql.some((s) => s.startsWith("SELECT data FROM app.streaks")), false, "no streak load");
  assert.deepEqual(appTablesWritten(sql), ["app.daily_activities"]);
  assert.equal(writesOf(sql).length, 1);
});

test("time ping when the IST day rolled over after the check: retried with the first-of-day load", async () => {
  // The existence check says "today exists", but the loaded rows have no row
  // for today: the handler reloads in full and pays the daily reward once.
  const sql = setup({
    "SELECT 1 FROM app.daily_activities": [{ "?column?": 1 }],
    "SELECT data FROM app.daily_activities": [{ data: activity("2020-01-01") }],
  });
  const request = await authedRequest(USER, "http://localhost/api/users/time", { method: "POST" });
  const response = await handleUsersRequest("POST", ["time"], request, { time_type: "practice", time_spent: 30 });
  assert.equal(response.status, 200);

  assert.ok(sql.some((s) => s.startsWith("SELECT data FROM app.point_logs")), "second pass loads the point log");
  assert.deepEqual(appTablesWritten(sql), ["app.daily_activities", "app.point_logs", "app.streaks", "app.user_scores"]);
  assert.equal(sql.filter((s) => s.startsWith("BEGIN")).length, 1, "the first pass wrote nothing");
});

test("time ping validation and auth answers are unchanged", async () => {
  setup({ "SELECT 1 FROM app.daily_activities": [{ "?column?": 1 }], "SELECT data FROM app.daily_activities": [{ data: activity(istDateKey()) }] });
  const request = await authedRequest(USER, "http://localhost/api/users/time", { method: "POST" });
  const bad = await handleUsersRequest("POST", ["time"], request, { time_type: "nope", time_spent: 60 });
  assert.equal(bad.status, 400);
  const zero = await handleUsersRequest("POST", ["time"], request, { time_type: "webpage", time_spent: 0 });
  assert.equal(zero.status, 400);
  const anonymous = await handleUsersRequest(
    "POST",
    ["time"],
    new Request("http://localhost/api/users/time", { method: "POST" }),
    { time_type: "webpage", time_spent: 60 },
  );
  assert.equal(anonymous.status, 401);
});

test("time ping: a token minted for an older auth_token_version is refused", async () => {
  installFakeUserPool({
    rowsFor: (sql) => (sql.startsWith("SELECT * FROM origin_users WHERE id = $1") ? [userRow(USER, { auth_token_version: 3 })] : undefined),
  });
  const request = await authedRequest(USER, "http://localhost/api/users/time", { method: "POST" });
  const response = await handleUsersRequest("POST", ["time"], request, { time_type: "webpage", time_spent: 60 });
  assert.equal(response.status, 401);
});

test("stats: per-user reads plus the SQL global rank, no whole-table read", async () => {
  const sql = setup({ [normalized(GLOBAL_SOLVED_RANK_SQL)]: [{ solved: 3, rank: 2 }] });
  const request = await authedRequest(USER, "http://localhost/api/users/stats");
  const response = await handleUsersRequest("GET", ["stats"], request, {});
  assert.equal(response.status, 200);
  const body = (await response.json()) as { global_rank: number | null; achievements: { top_100: boolean } };
  assert.equal(body.global_rank, 2);
  assert.equal(body.achievements.top_100, true);
  assert.deepEqual(fullTableReads(sql), []);
  assert.deepEqual(writesOf(sql), []);
});

test("stats: nothing solved means no rank", async () => {
  setup();
  const request = await authedRequest(USER, "http://localhost/api/users/stats");
  const body = (await (await handleUsersRequest("GET", ["stats"], request, {})).json()) as { global_rank: number | null };
  assert.equal(body.global_rank, null);
});

test("globalRankingForOneUser holds just the caller's entry", () => {
  const ranking = globalRankingForOneUser(USER, { solved: 4, rank: 7 });
  assert.equal(ranking.rankByUser.get(USER), 7);
  assert.equal(ranking.solvedCountByUser.get(USER), 4);
  const none = globalRankingForOneUser(USER, null);
  assert.equal(none.rankByUser.size, 0);
  assert.equal(none.solvedCountByUser.size, 0);
});

test("points: the score and the newest 10 logs only", async () => {
  const sql = setup({
    "SELECT data FROM app.user_scores": [{ data: { userId: USER, totalPoints: 120, currentTier: "Bronze", lastUpdated: "2026-11-01" } }],
  });
  const request = await authedRequest(USER, "http://localhost/api/users/points");
  const response = await handleUsersRequest("GET", ["points"], request, {});
  assert.equal(response.status, 200);
  assert.equal(((await response.json()) as { totalPoints: number }).totalPoints, 120);
  assert.ok(sql.some((s) => s.startsWith("SELECT data FROM app.point_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2")));
  assert.deepEqual(fullTableReads(sql), []);
});

test("me: served from the caller's fresh row (works for an account no snapshot has seen)", async () => {
  const sql = setup();
  const request = await authedRequest(USER, "http://localhost/api/users/me");
  const response = await handleUsersRequest("GET", ["me"], request, {});
  assert.equal(response.status, 200);
  assert.equal(((await response.json()) as { id: string }).id, USER);
  assert.deepEqual(fullTableReads(sql), []);
});

test("pomodoro list: only the caller's sessions are read", async () => {
  const sql = setup();
  const request = await authedRequest(USER, "http://localhost/api/users/pomodoro");
  const response = await handleUsersRequest("GET", ["pomodoro"], request, {});
  assert.equal(response.status, 200);
  assert.deepEqual(fullTableReads(sql), []);
  assert.ok(sql.some((s) => s.startsWith("SELECT data FROM app.pomodoro_sessions WHERE user_id = $1")));
});

test("login streak: a later touch on the same day writes nothing", async () => {
  const today = istDateKey();
  const sql = setup({
    "SELECT data FROM app.streaks": [
      {
        data: {
          userId: USER,
          currentStreak: 0,
          longestStreak: 0,
          lastStudyDate: today,
          lastCelebratedDate: today,
          weeklyData: [false, false, false, false, false, false, false],
          freezesRemaining: 2,
          freezeMonth: today.slice(0, 7),
        },
      },
    ],
  });
  const result = await recordDailyLoginStreak(USER);
  assert.equal(result?.celebrate, false);
  assert.deepEqual(writesOf(sql), []);
  assert.deepEqual(fullTableReads(sql), []);
});

test("login streak: the first touch of the day writes the streak row and the user's streak", async () => {
  const sql = setup();
  const result = await recordDailyLoginStreak(USER);
  assert.equal(result?.event, "first");
  assert.equal(result?.celebrate, true);
  assert.deepEqual(appTablesWritten(sql), ["app.streaks"]);
  assert.ok(sql.some((s) => s.startsWith("INSERT INTO origin_users")), "user.streak mirror persisted");
});

test("withFreshUserInStore: checks the fresh row and folds it into a snapshot that lacks it", async () => {
  installFakeUserPool({
    rowsFor: (sql) => (sql.startsWith("SELECT * FROM origin_users WHERE id = $1") ? [userRow(USER, { name: "Fresh Name" })] : undefined),
  });
  const snapshot = { users: [] } as unknown as AppStore;
  const user = await withFreshUserInStore(snapshot, await authedRequest(USER));
  assert.equal(user?.id, USER);
  assert.equal(snapshot.users.length, 1);

  // An existing (stale) entry is updated in place and returned.
  const stale = { users: [{ id: USER, name: "Old Name", authTokenVersion: 0 }] } as unknown as AppStore;
  const again = await withFreshUserInStore(stale, await authedRequest(USER));
  assert.equal(again, stale.users[0]);
  assert.equal(stale.users[0].name, "Fresh Name");

  assert.equal(await withFreshUserInStore(snapshot, new Request("http://localhost/x")), null);
});

test("withFreshUserInStore: a version bump on another instance is honoured, and a DB failure is a 503-type error", async () => {
  installFakeUserPool({
    rowsFor: (sql) => (sql.startsWith("SELECT * FROM origin_users WHERE id = $1") ? [userRow(USER, { auth_token_version: 1 })] : undefined),
  });
  const snapshot = { users: [{ id: USER, authTokenVersion: 0 }] } as unknown as AppStore;
  assert.equal(await withFreshUserInStore(snapshot, await authedRequest(USER)), null, "old token refused");

  installFakeUserPool({ failFor: (sql) => sql.startsWith("SELECT * FROM origin_users") });
  await assert.rejects(withFreshUserInStore(snapshot, await authedRequest(USER)), { name: "AuthServiceUnavailableError" });
});

test("homeStoreLoads: score, newest 10 logs and a 15-day attempt window", () => {
  const now = Date.parse("2026-11-03T12:00:00.000Z");
  assert.deepEqual(homeStoreLoads(now), {
    userScores: true,
    pointLogs: { limit: 10 },
    practiceAttempts: { createdSince: "2026-10-19T12:00:00.000Z" },
  });
});
