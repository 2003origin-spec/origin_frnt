/**
 * deck-answer-submit-serial-chain: POST /api/assessments/practice/:id/submit
 * loads only the student's rows it reads (attempts and point logs of THIS
 * question, their streak / daily activity / score / subject-rank rows) instead
 * of hydrating every user's store under the global lock, and writes only the
 * rows that changed instead of the student's whole history. Fake pools.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { NextRequest } from "next/server";

import { readStoreAsync } from "../../src/server/store";
import { authedRequest, installFakeUserPool, userRow, writesOf } from "./_scoped-store-fakes";

process.env.TEACHER_LAUNCH_OGCODE_SCORING_V2 = "0";

const USER = "user_scoped_practice_a";
const QUESTION = "ogq_scoped_practice_1";

type G = Record<string, unknown>;
const g = globalThis as unknown as G;

type Handler = (request: NextRequest, context: { params: Promise<{ slug?: string[] }> }) => Promise<Response>;

function installFakeCatalog() {
  const query = async (text: string) => {
    const sql = text.replace(/\s+/g, " ").trim();
    if (sql.startsWith("SELECT id, source_index")) {
      return {
        rows: [
          {
            id: QUESTION,
            text: "2 + 2 = ?",
            options: [],
            correct_option: null,
            correct_options: null,
            answer_text: "4",
            explanation: "Because.",
            subject: "mathematics",
            chapter: "Arithmetic",
            concept: "Addition",
            difficulty: "easy",
            question_type: "numerical",
          },
        ],
      };
    }
    return { rows: [] };
  };
  process.env.OGCODE_DATABASE_URL = "postgres://fake:fake@127.0.0.1:1/fake_catalog";
  g.__originOgcodeCatalogSchemaReady = Promise.resolve();
  g.__originOgcodePool = { query, connect: async () => ({ query, release: () => undefined }), end: async () => undefined };
}

function fullTableReads(sql: string[]): string[] {
  return sql.filter(
    (s) => /^SELECT (data|\*) FROM app\.[a-z_]+ ORDER BY/.test(s) || s === "SELECT * FROM origin_users ORDER BY joined_at ASC",
  );
}

test("practice submit: per-user, per-question loads and only the changed rows written", async () => {
  installFakeCatalog();
  const loads: Array<{ sql: string; values?: unknown[] }> = [];
  const sql = installFakeUserPool({
    onQuery: (statement, values) => {
      if (statement.startsWith("SELECT data FROM app.")) loads.push({ sql: statement, values });
    },
    rowsFor: (statement) => {
      if (statement.startsWith("SELECT * FROM origin_users WHERE id = $1")) return [userRow(USER)];
      // An old, unrelated subject-rank row: unchanged by a wrong answer, so never rewritten.
      if (statement.startsWith("SELECT data FROM app.subject_ranks")) {
        return [{ data: { userId: USER, subject: "physics", questionsSolved: 3, rankScore: 30, latitude: null, longitude: null, locationShared: false, updatedAt: "2026-10-01T00:00:00.000Z" } }];
      }
      return undefined;
    },
  });

  // The route's read handlers share the 5-minute whole-store snapshot; warm it
  // so the log below holds only what THIS request does.
  await readStoreAsync();
  sql.length = 0;
  loads.length = 0;

  const { POST } = (await import("../../src/app/api/assessments/[...slug]/route")) as unknown as Record<"POST", Handler>;
  const request = await authedRequest(USER, `http://localhost/api/assessments/practice/${QUESTION}/submit`, {
    method: "POST",
    body: JSON.stringify({ answer_text: "5", time_spent: 12 }),
    headers: { "content-type": "application/json" },
  });
  // revalidateTag() needs the Next runtime and throws here AFTER the scoped
  // write committed, so assert on the SQL, not the status.
  await POST(new NextRequest(request), { params: Promise.resolve({ slug: ["practice", QUESTION, "submit"] }) });

  assert.deepEqual(fullTableReads(sql), [], "no whole-store hydration");
  const attemptsLoad = loads.find((entry) => entry.sql.startsWith("SELECT data FROM app.practice_attempts"));
  assert.deepEqual(attemptsLoad?.values, [USER, "questionId", QUESTION]);
  const logsLoad = loads.find((entry) => entry.sql.startsWith("SELECT data FROM app.point_logs"));
  assert.deepEqual(logsLoad?.values, [USER, "referenceId", QUESTION]);
  for (const entry of loads) assert.match(entry.sql, /WHERE user_id = \$1/);

  const writes = writesOf(sql);
  const tables = [...new Set(writes.map((s) => s.match(/^INSERT INTO (app\.[a-z_]+|origin_users)/)?.[1]).filter(Boolean))].sort();
  // Wrong answer: the new attempt, today's activity and the streak; no points,
  // no subject rank (the loaded physics row is unchanged).
  assert.deepEqual(tables, ["app.daily_activities", "app.practice_attempts", "app.streaks", "origin_users"]);
  const attemptInsert = writes.find((s) => s.startsWith("INSERT INTO app.practice_attempts"))!;
  assert.equal((attemptInsert.match(/::jsonb/g) ?? []).length, 1, "exactly one attempt row written");
});

test("practice submit (correct): points, score and the new subject rank; the untouched rank row is not rewritten", async () => {
  installFakeCatalog();
  const sql = installFakeUserPool({
    rowsFor: (statement) => {
      if (statement.startsWith("SELECT * FROM origin_users WHERE id = $1")) return [userRow(USER)];
      if (statement.startsWith("SELECT data FROM app.subject_ranks")) {
        return [{ data: { userId: USER, subject: "physics", questionsSolved: 3, rankScore: 30, latitude: null, longitude: null, locationShared: false, updatedAt: "2026-10-01T00:00:00.000Z" } }];
      }
      return undefined;
    },
  });
  await readStoreAsync();
  sql.length = 0;

  const { POST } = (await import("../../src/app/api/assessments/[...slug]/route")) as unknown as Record<"POST", Handler>;
  const request = await authedRequest(USER, `http://localhost/api/assessments/practice/${QUESTION}/submit`, {
    method: "POST",
    body: JSON.stringify({ answer_text: "4", time_spent: 12 }),
    headers: { "content-type": "application/json" },
  });
  await POST(new NextRequest(request), { params: Promise.resolve({ slug: ["practice", QUESTION, "submit"] }) });

  const writes = writesOf(sql);
  const tables = [...new Set(writes.map((s) => s.match(/^INSERT INTO (app\.[a-z_]+|origin_users)/)?.[1]).filter(Boolean))].sort();
  assert.deepEqual(tables, [
    "app.daily_activities",
    "app.point_logs",
    "app.practice_attempts",
    "app.streaks",
    "app.subject_ranks",
    "app.user_scores",
    "origin_users",
  ]);
  const rankInsert = writes.find((s) => s.startsWith("INSERT INTO app.subject_ranks"))!;
  assert.equal((rankInsert.match(/::jsonb/g) ?? []).length, 1, "only the new mathematics rank row");
  assert.deepEqual(fullTableReads(sql), []);
});
