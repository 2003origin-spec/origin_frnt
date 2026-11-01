/**
 * C6 (study rooms): `submitRoomTest` must check the room timer BEFORE
 * `submitTest` persists an analytics.test_results row, and must never reject
 * after that row exists. Runs against a fake rooms pool installed through the
 * `globalThis.__originOgcodePool` slot — no database, no Redis.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  finishRoomParticipantAfterResult,
  roomTimerExpired,
  StudyRoomError,
  submitRoomTest,
} from "../../src/legacy/study-rooms";
import type { AppStore, StoredUser } from "../../src/server/store";

delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

const ROOM_ID = "room_timer";
const USER_ID = "user_1";
const DURATION = 600;

type Handler = (sql: string, params: unknown[]) => Record<string, unknown>[] | undefined;

function roomRow(startedAgoSeconds: number): Record<string, unknown> {
  return {
    id: ROOM_ID,
    name: "Room",
    admin_user_id: "admin_1",
    created_by: "admin_1",
    status: "in_test",
    custom_test_id: "ctest_1",
    duration_seconds: DURATION,
    started_at: new Date(Date.now() - startedAgoSeconds * 1000),
    ended_at: null,
    scheduled_start_at: null,
    max_participants: 10,
    created_at: new Date(),
    updated_at: new Date(),
    room_kind: "student_room",
  };
}

const participantRow = {
  room_id: ROOM_ID,
  user_id: USER_ID,
  display_name: "Student",
  role: "participant",
  joined_at: new Date(),
  left_at: null,
  kicked: false,
  finished_at: null,
};

/** Installs a fake ogcode/rooms pool; returns every statement it saw. */
function installFakeRoomsPool(handler: Handler): { statements: { sql: string; params: unknown[] }[] } {
  const statements: { sql: string; params: unknown[] }[] = [];
  const run = async (sql: string, params: unknown[] = []) => {
    statements.push({ sql, params });
    return { rows: handler(sql, params) ?? [] };
  };
  process.env.OGCODE_DATABASE_URL = "postgres://fake:fake@localhost:5432/fake";
  globalThis.__originOgcodePool = {
    query: run,
    connect: async () => ({ query: run, release: () => undefined }),
    end: async () => undefined,
  } as never;
  globalThis.__originRoomsSchemaReady = Promise.resolve();
  return { statements };
}

/** A store that fails loudly if submitTest ever reaches it. */
const untouchableStore = new Proxy({} as AppStore, {
  get(_target, prop) {
    throw new Error(`submitTest touched the store (${String(prop)}) — it must not run`);
  },
});

const user = { id: USER_ID, name: "Student" } as unknown as StoredUser;

test("roomTimerExpired matches finishRoomParticipant's duration + 10 s boundary", () => {
  const start = Date.parse("2026-10-22T10:00:00.000Z");
  const startedAt = new Date(start).toISOString();
  assert.equal(roomTimerExpired(startedAt, DURATION, start + (DURATION + 10) * 1000), false);
  assert.equal(roomTimerExpired(startedAt, DURATION, start + (DURATION + 11) * 1000), true);
  assert.equal(roomTimerExpired(null, DURATION, start + 10 ** 9), false);
  assert.equal(roomTimerExpired(startedAt, null, start + 10 ** 9), false);
});

test("an expired timer is rejected 409 BEFORE submitTest writes a result", async () => {
  // The room is live when the state is read, and its timer has run out by the
  // time the submit gets to the write (the race the reorder closes).
  const { statements } = installFakeRoomsPool((sql) => {
    if (sql.includes("SELECT started_at, duration_seconds FROM rooms.rooms")) {
      return [{ started_at: new Date(Date.now() - (DURATION + 11) * 1000), duration_seconds: DURATION }];
    }
    if (sql.includes("FROM rooms.rooms WHERE id = $1")) return [roomRow(60)];
    if (sql.includes("FROM rooms.room_participants")) return [participantRow];
    return [];
  });

  await assert.rejects(
    submitRoomTest(untouchableStore, user, ROOM_ID, { answers: {} } as never),
    (error: unknown) => {
      assert.ok(error instanceof StudyRoomError, String(error));
      assert.equal(error.status, 409);
      assert.match(error.message, /timer has expired/);
      return true;
    },
  );
  assert.ok(!statements.some(({ sql }) => /test_results/i.test(sql) && /INSERT/i.test(sql)), "no result row written");
  assert.ok(
    !statements.some(({ sql }) => sql.includes("SET finished_at")),
    "participant row not finished",
  );
});

test("after a persisted result, an expired timer degrades to auto-submitted instead of throwing", async () => {
  const { statements } = installFakeRoomsPool((sql) => {
    if (sql.includes("FROM rooms.rooms WHERE id = $1")) return [roomRow(DURATION + 60)];
    if (sql.includes("SELECT * FROM rooms.room_participants")) return [participantRow];
    if (sql.includes("COUNT(*)::int AS count")) return [{ count: 0 }];
    if (sql.includes("SELECT rank FROM rooms.room_participants")) return [{ rank: 1 }];
    if (sql.includes("RETURNING ended_at")) return [{ ended_at: new Date() }];
    return [];
  });

  const finish = await finishRoomParticipantAfterResult(ROOM_ID, USER_ID, {
    testResultId: "result_1",
    score: 12,
    timeTakenSeconds: DURATION,
  });

  assert.equal(finish.rank, 1);
  const finishes = statements.filter(({ sql }) => sql.includes("SET finished_at = COALESCE(finished_at, NOW())"));
  assert.equal(finishes.length, 1, "exactly one finish write");
  assert.equal(finishes[0].params[2], "result_1", "the stored result is attached, not orphaned");
  assert.equal(finishes[0].params[5], true, "recorded as auto-submitted");
});
