/**
 * Study-room finish path (docs/bug-fixes/10-new-social-rooms-ogcode.md N1 + N2).
 *
 * N1: `transaction()` must not run DDL (`ALTER TABLE … IF NOT EXISTS`,
 *     `CREATE …`) on the transaction client — that took ACCESS EXCLUSIVE locks
 *     on every lobby poll. The memoised pool-level ensure runs the DDL once.
 * N2: `/api/study-rooms/[id]/finish` is a pure auto-submit signal. The client
 *     body can no longer set `score` / `time_taken_seconds` / `auto_submitted`,
 *     and `finishRoomParticipant` refuses a second finish (409) or a finish on
 *     a room that is already over (423).
 *
 * No live Postgres/Redis: the ogcode + user pools are replaced by scripted
 * fakes injected through the same `globalThis` slots the pool factories use.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type { Pool } from "pg";

// Env must be in place before any `@/server/*` module is first imported, so
// every import below is a dynamic one inside the test bodies.
process.env.OGCODE_DATABASE_URL ??= "postgres://origin:origin@127.0.0.1:5432/origin_finish_test";
process.env.USER_DATABASE_URL ??= "postgres://origin:origin@127.0.0.1:5432/origin_finish_test";
process.env.AUTH_JWT_SECRET_CURRENT ??= randomBytes(48).toString("base64url");

type QueryCall = { text: string; values: unknown[] | undefined };
type RowsFor = (text: string, values: unknown[] | undefined) => Record<string, unknown>[];

const DDL_PATTERN = /ALTER TABLE|CREATE (TABLE|INDEX|UNIQUE INDEX|SCHEMA|TYPE|EXTENSION)|DO \$\$/i;

function createFakePool(rowsFor: RowsFor) {
  const poolCalls: QueryCall[] = [];
  const clientCalls: QueryCall[] = [];
  const answer = (text: string, values: unknown[] | undefined) => {
    const rows = rowsFor(text, values);
    return { rows, rowCount: rows.length };
  };
  const client = {
    async query(text: string, values?: unknown[]) {
      clientCalls.push({ text, values });
      return answer(text, values);
    },
    release() {},
  };
  const pool = {
    async query(text: string, values?: unknown[]) {
      poolCalls.push({ text, values });
      return answer(text, values);
    },
    async connect() {
      return client;
    },
  };
  return { pool: pool as unknown as Pool, client, poolCalls, clientCalls };
}

const ROOM_ID = "room_finish_test";
const USER_ID = "user_finish_test";
const DURATION_SECONDS = 600;

function baseRoom(): Record<string, unknown> {
  return {
    id: ROOM_ID,
    name: "Finish test room",
    admin_user_id: USER_ID,
    created_by: USER_ID,
    status: "in_test",
    custom_test_id: "test_1",
    duration_seconds: DURATION_SECONDS,
    started_at: new Date(Date.now() - 60_000),
    ended_at: null,
    scheduled_start_at: null,
    max_participants: 10,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

function baseParticipant(): Record<string, unknown> {
  return {
    room_id: ROOM_ID,
    user_id: USER_ID,
    display_name: "Finisher",
    role: "admin",
    joined_at: new Date(Date.now() - 120_000),
    left_at: null,
    kicked: false,
    finished_at: null,
    score: null,
    rank: null,
    time_taken_seconds: null,
    test_result_id: null,
    auto_submitted: false,
  };
}

const scenario = {
  room: baseRoom(),
  participant: baseParticipant(),
  unfinishedAfterUpdate: 1,
};

function resetScenario(overrides: { room?: Partial<Record<string, unknown>>; participant?: Partial<Record<string, unknown>> } = {}) {
  scenario.room = { ...baseRoom(), ...overrides.room };
  scenario.participant = { ...baseParticipant(), ...overrides.participant };
  scenario.unfinishedAfterUpdate = 1;
}

const roomsRowsFor: RowsFor = (text) => {
  if (/FROM rooms\.rooms WHERE id = \$1/.test(text)) return [scenario.room];
  // Checked before the generic participant pattern: same WHERE shape.
  if (/SELECT rank FROM rooms\.room_participants/.test(text)) return [{ rank: 1 }];
  if (/FROM rooms\.room_participants\s+WHERE room_id = \$1 AND user_id = \$2/.test(text)) return [scenario.participant];
  if (/COUNT\(\*\)::int AS count/.test(text)) return [{ count: scenario.unfinishedAfterUpdate }];
  if (/UPDATE rooms\.rooms/.test(text) && /RETURNING ended_at/.test(text)) return [{ ended_at: new Date() }];
  return [];
};

const userRowsFor: RowsFor = (text) => {
  if (/FROM origin_users WHERE id = \$1/.test(text)) {
    return [
      {
        id: USER_ID,
        name: "Finisher",
        email: "finisher@example.com",
        password_hash: "x",
        role: "student",
        joined_at: new Date(),
        usage_reset_at: new Date(),
        auth_token_version: 0,
        account_status: "active",
      },
    ];
  }
  return [];
};

const roomsPool = createFakePool(roomsRowsFor);
const userPool = createFakePool(userRowsFor);

declare global {
  var __originOgcodePool: Pool | undefined;
  var __originUserPool: Pool | undefined;
  var __originUserPoolConnectionString: string | undefined;
  var __originUserSchemaEnsured: boolean | undefined;
  var __originRoomsSchemaReady: Promise<void> | undefined;
}

globalThis.__originOgcodePool = roomsPool.pool;
globalThis.__originUserPool = userPool.pool;
globalThis.__originUserSchemaEnsured = true;

function participantUpdate(calls: QueryCall[]): QueryCall | undefined {
  return calls.find((call) => /UPDATE rooms\.room_participants\s+SET finished_at/.test(call.text));
}

async function loadStudyRooms() {
  return import("@/legacy/study-rooms");
}

test("transaction() runs no DDL on the client; the pool-level ensure runs it once", async () => {
  const { finishRoomParticipant } = await loadStudyRooms();
  resetScenario();
  roomsPool.clientCalls.length = 0;

  const result = await finishRoomParticipant(ROOM_ID, USER_ID, {
    testResultId: "result_1",
    score: 42,
    timeTakenSeconds: 120,
  });
  assert.equal(result.rank, 1);

  const clientTexts = roomsPool.clientCalls.map((call) => call.text);
  assert.equal(clientTexts[0], "BEGIN");
  assert.equal(clientTexts[clientTexts.length - 1], "COMMIT");
  const ddlOnClient = clientTexts.filter((text) => DDL_PATTERN.test(text));
  assert.deepEqual(ddlOnClient, [], "no ALTER TABLE / CREATE statement may run inside the transaction");

  // The schema was still ensured: the DDL went to the pool, not the client.
  const ddlOnPool = roomsPool.poolCalls.filter((call) => DDL_PATTERN.test(call.text));
  assert.ok(ddlOnPool.some((call) => /CREATE SCHEMA IF NOT EXISTS rooms/.test(call.text)), "rooms DDL ran at pool level");
  assert.ok(ddlOnPool.some((call) => /CREATE SCHEMA IF NOT EXISTS analytics/.test(call.text)), "analytics DDL ran at pool level");

  // A second transaction re-runs nothing.
  const poolCallsBefore = roomsPool.poolCalls.length;
  resetScenario();
  roomsPool.clientCalls.length = 0;
  await finishRoomParticipant(ROOM_ID, USER_ID, { testResultId: "result_2", score: 10 });
  assert.equal(roomsPool.poolCalls.length, poolCallsBefore, "pool-level ensure is memoised");
  assert.deepEqual(
    roomsPool.clientCalls.filter((call) => DDL_PATTERN.test(call.text)),
    [],
  );
});

test("ensureRoomsSchema(client) and ensureAnalyticsSchema(client) never query the given client once ready", async () => {
  const { ensureRoomsSchema } = await import("@/server/rooms-postgres");
  const { ensureAnalyticsSchema } = await import("@/server/analytics-store");
  await ensureRoomsSchema();

  const spy = createFakePool(() => []);
  await ensureRoomsSchema(spy.client as never);
  await ensureAnalyticsSchema(spy.client as never);
  assert.deepEqual(spy.clientCalls, []);
  assert.deepEqual(spy.poolCalls, []);
});

test("finishRoomParticipant rejects a second finish with 409", async () => {
  const { finishRoomParticipant, StudyRoomError } = await loadStudyRooms();
  resetScenario({ participant: { finished_at: new Date(Date.now() - 5_000), score: 80 } });
  roomsPool.clientCalls.length = 0;

  await assert.rejects(
    finishRoomParticipant(ROOM_ID, USER_ID, { testResultId: "result_3", score: 300, timeTakenSeconds: 1 }),
    (error: unknown) => error instanceof StudyRoomError && error.status === 409,
  );
  assert.equal(participantUpdate(roomsPool.clientCalls), undefined, "no score rewrite was issued");
  assert.equal(roomsPool.clientCalls.at(-1)?.text, "ROLLBACK");
});

test("finishRoomParticipant rejects a finish on a finished room with 423", async () => {
  const { finishRoomParticipant, StudyRoomError } = await loadStudyRooms();
  resetScenario({ room: { status: "finished", ended_at: new Date() } });
  roomsPool.clientCalls.length = 0;

  await assert.rejects(
    finishRoomParticipant(ROOM_ID, USER_ID, { testResultId: null, score: null, autoSubmitted: true }),
    (error: unknown) => error instanceof StudyRoomError && error.status === 423,
  );
  assert.equal(participantUpdate(roomsPool.clientCalls), undefined);
  assert.equal(roomsPool.clientCalls.at(-1)?.text, "ROLLBACK");
});

test("auto-submit uses the server-computed elapsed time even past the deadline", async () => {
  const { finishRoomParticipant } = await loadStudyRooms();
  // Started long enough ago that a normal submit would be rejected (409).
  resetScenario({ room: { started_at: new Date(Date.now() - (DURATION_SECONDS + 60) * 1000) } });
  roomsPool.clientCalls.length = 0;

  await finishRoomParticipant(ROOM_ID, USER_ID, {
    testResultId: null,
    score: null,
    timeTakenSeconds: 1,
    autoSubmitted: true,
  });
  const update = participantUpdate(roomsPool.clientCalls);
  assert.ok(update, "participant row was finished");
  const [roomId, userId, testResultId, score, timeTaken, autoSubmitted] = update.values ?? [];
  assert.equal(roomId, ROOM_ID);
  assert.equal(userId, USER_ID);
  assert.equal(testResultId, null);
  assert.equal(score, null);
  assert.equal(timeTaken, DURATION_SECONDS + 10, "clamped server elapsed time, not the client's 1s");
  assert.equal(autoSubmitted, true);
});

function replacementUpdate(calls: QueryCall[]): QueryCall | undefined {
  return calls.find((call) => /UPDATE rooms\.room_participants\s+SET test_result_id = \$3/.test(call.text));
}

/** The state autoFinishExpiredRoom leaves behind: finished, auto, no result, score 0. */
function autoFinishedByFinaliser(startedSecondsAgo: number) {
  resetScenario({
    room: { status: "finished", ended_at: new Date(), started_at: new Date(Date.now() - startedSecondsAgo * 1000) },
    participant: {
      finished_at: new Date(Date.now() - 2_000),
      auto_submitted: true,
      test_result_id: null,
      score: 0,
      time_taken_seconds: DURATION_SECONDS,
    },
  });
  scenario.unfinishedAfterUpdate = 0;
}

test("H1: a scored submit in flight when the finaliser ran replaces the empty auto-finish", async () => {
  const { finishRoomParticipant } = await loadStudyRooms();
  // Deadline (duration + 10 s) passed 5 s ago: the finaliser already ran.
  autoFinishedByFinaliser(DURATION_SECONDS + 15);
  roomsPool.clientCalls.length = 0;

  const result = await finishRoomParticipant(ROOM_ID, USER_ID, {
    testResultId: "result_real",
    score: 37,
    timeTakenSeconds: 590,
  });
  assert.equal(result.rank, 1);
  assert.ok(result.ended_at, "ended_at of the already finished room is returned");

  assert.equal(participantUpdate(roomsPool.clientCalls), undefined, "the generic finish update is not used");
  const update = replacementUpdate(roomsPool.clientCalls);
  assert.ok(update, "the empty auto-finish was replaced");
  assert.match(update.text, /test_result_id IS NULL/, "one-time upgrade guard in SQL");
  const [roomId, userId, testResultId, score, timeTaken, autoSubmitted] = update.values ?? [];
  assert.equal(roomId, ROOM_ID);
  assert.equal(userId, USER_ID);
  assert.equal(testResultId, "result_real");
  assert.equal(score, 37);
  assert.equal(timeTaken, 590);
  assert.equal(autoSubmitted, false);
  assert.ok(
    roomsPool.clientCalls.some((call) => /SET rank = ranked\.computed_rank/.test(call.text)),
    "ranks were re-persisted",
  );
  assert.ok(
    !roomsPool.clientCalls.some((call) => /UPDATE rooms\.rooms/.test(call.text)),
    "a finished room is not re-finished",
  );
  assert.equal(roomsPool.clientCalls.at(-1)?.text, "COMMIT");
});

test("H1: the timer-degraded retry (autoSubmitted + result) also replaces the empty auto-finish", async () => {
  const { finishRoomParticipant } = await loadStudyRooms();
  autoFinishedByFinaliser(DURATION_SECONDS + 30);
  roomsPool.clientCalls.length = 0;

  await finishRoomParticipant(ROOM_ID, USER_ID, {
    testResultId: "result_real",
    score: 12,
    timeTakenSeconds: 1,
    autoSubmitted: true,
  });
  const update = replacementUpdate(roomsPool.clientCalls);
  assert.ok(update);
  const [, , testResultId, score, timeTaken, autoSubmitted] = update.values ?? [];
  assert.equal(testResultId, "result_real");
  assert.equal(score, 12);
  assert.equal(timeTaken, DURATION_SECONDS + 10, "auto path keeps the server-clamped time");
  assert.equal(autoSubmitted, true);
});

test("H1: a second scored submit after a real result is still a 409", async () => {
  const { finishRoomParticipant, StudyRoomError } = await loadStudyRooms();
  autoFinishedByFinaliser(DURATION_SECONDS + 15);
  scenario.participant = { ...scenario.participant, test_result_id: "result_first", score: 50 };
  roomsPool.clientCalls.length = 0;

  await assert.rejects(
    finishRoomParticipant(ROOM_ID, USER_ID, { testResultId: "result_second", score: 99, timeTakenSeconds: 10 }),
    (error: unknown) => error instanceof StudyRoomError && error.status === 409,
  );
  assert.equal(replacementUpdate(roomsPool.clientCalls), undefined);
  assert.equal(participantUpdate(roomsPool.clientCalls), undefined);
  assert.equal(roomsPool.clientCalls.at(-1)?.text, "ROLLBACK");
});

test("H1: an empty auto-finish is not replaced by another auto-submit without a result", async () => {
  const { finishRoomParticipant, StudyRoomError } = await loadStudyRooms();
  autoFinishedByFinaliser(DURATION_SECONDS + 15);
  roomsPool.clientCalls.length = 0;

  await assert.rejects(
    finishRoomParticipant(ROOM_ID, USER_ID, { testResultId: null, score: null, autoSubmitted: true }),
    (error: unknown) => error instanceof StudyRoomError && error.status === 409,
  );
  assert.equal(replacementUpdate(roomsPool.clientCalls), undefined);
});

test("H1: a scored result after the late grace is rejected", async () => {
  const { finishRoomParticipant, StudyRoomError, ROOM_SCORED_RESULT_LATE_GRACE_SECONDS } = await loadStudyRooms();
  autoFinishedByFinaliser(DURATION_SECONDS + 10 + ROOM_SCORED_RESULT_LATE_GRACE_SECONDS + 30);
  roomsPool.clientCalls.length = 0;

  await assert.rejects(
    finishRoomParticipant(ROOM_ID, USER_ID, { testResultId: "result_late", score: 40, timeTakenSeconds: 100 }),
    (error: unknown) => error instanceof StudyRoomError && error.status === 409,
  );
  assert.equal(replacementUpdate(roomsPool.clientCalls), undefined);
  assert.equal(roomsPool.clientCalls.at(-1)?.text, "ROLLBACK");
});

test("POST /api/study-rooms/[id]/finish ignores a client-supplied score", async () => {
  const { createPostgresPoolConfig } = await import("@/server/postgres-config");
  globalThis.__originUserPoolConnectionString = createPostgresPoolConfig(
    process.env.USER_DATABASE_URL as string,
    25,
  ).connectionString;

  const { issueAccessTokenForUser, ACCESS_FINGERPRINT_COOKIE_NAME } = await import("@/server/auth-jwt");
  const { POST } = await import("../../src/app/api/study-rooms/[id]/finish/route");

  const token = await issueAccessTokenForUser(
    { id: USER_ID, role: "student", authTokenVersion: 0 } as never,
    "session_finish_test",
  );

  resetScenario();
  roomsPool.clientCalls.length = 0;

  const request = new Request(`http://localhost/api/study-rooms/${ROOM_ID}/finish`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token.accessToken}`,
      cookie: `${ACCESS_FINGERPRINT_COOKIE_NAME}=${token.accessFingerprint}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ score: 300, time_taken_seconds: 1, auto_submitted: true, test_result_id: "forged" }),
  });
  const response = await POST(request as never, { params: Promise.resolve({ id: ROOM_ID }) });
  assert.equal(response.status, 200, await response.text().catch(() => ""));

  const update = participantUpdate(roomsPool.clientCalls);
  assert.ok(update, "participant row was finished");
  const [, , testResultId, score, timeTaken, autoSubmitted] = update.values ?? [];
  assert.equal(testResultId, null, "test_result_id from the body is ignored");
  assert.equal(score, null, "the service receives score: null");
  assert.ok(typeof timeTaken === "number" && timeTaken >= 60 && timeTaken <= DURATION_SECONDS + 10, `server elapsed, got ${timeTaken}`);
  assert.equal(autoSubmitted, true);
});
