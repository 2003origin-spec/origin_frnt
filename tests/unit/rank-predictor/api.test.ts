/**
 * T3 — Rank Predictor signed-in API (V1/percentile-predictor/TEST_CASES.md §T3)
 * through the real handlers: GET /api/assessments/rank-predictor/* (the branch
 * the assessments catch-all forwards to) and POST /api/public/rank-predictor.
 * A fake pg pool stands in for analytics.test_results; auth and the runtime
 * flag are stubbed.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createFakePool, stubModules } from "../_module-stubs";

type FakeUser = { id: string; role: "student" | "teacher" | "admin" };

const pool = createFakePool();
let currentUser: FakeUser | null = { id: "u_student", role: "student" };
let flagOn = true;

type Row = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  score: number;
  total_marks: number;
  subject_stats: Record<string, unknown>;
  assignment_id: string | null;
  exam_preset: string | null;
  is_malpractice: boolean;
};
let rows: Row[] = [];

pool.handler = (sql, params) => {
  if (!sql.includes("analytics.test_results")) return undefined;
  const visible = rows.filter((r) => !r.is_malpractice).sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (sql.includes("r.id = $1")) {
    const [id, userId] = params as string[];
    return { rows: visible.filter((r) => r.id === id && r.user_id === userId) };
  }
  const [userId, exam] = params as string[];
  const mocksOnly = sql.includes("c.exam_preset = $2") && !sql.includes("IS NULL OR");
  return {
    rows: visible.filter(
      (r) => r.user_id === userId && (mocksOnly ? r.exam_preset === exam : r.exam_preset === null || r.exam_preset === exam),
    ),
  };
};

stubModules({
  "server-only": {},
  "@/server/postgres": (real: object) => ({ ...real, getOgcodePostgresPool: () => pool }),
  "@/legacy/analytics-store": (real: object) => ({ ...real, ensureAnalyticsTables: async () => undefined }),
  "@/server/feature-flags-runtime": (real: object) => ({ ...real, isFeatureEnabledRuntime: async () => flagOn }),
  "@/server/auth": (real: object) => ({ ...real, resolveTokenToUser: async () => currentUser }),
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { handleRankPredictorGet } = require("@/server/rank-predictor/routes") as typeof import("@/server/rank-predictor/routes");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST } = require("@/app/api/public/rank-predictor/route") as typeof import("@/app/api/public/rank-predictor/route");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getApiRoutePolicy } = require("@/server/route-policy") as typeof import("@/server/route-policy");

function get(path: string) {
  const url = `http://localhost/api/assessments/${path}`;
  const slug = new URL(url).pathname.split("/").slice(3).filter(Boolean);
  return handleRankPredictorGet(new Request(url), slug);
}

function post(body: unknown, raw?: string) {
  const text = raw ?? JSON.stringify(body);
  return POST(
    new Request("http://localhost/api/public/rank-predictor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: text,
    }) as never,
  );
}

const NEET_BODY = { exam: "neet", marks: { physics: 120, chemistry: 130, biology: 300 }, category: "general", pwd: false };

function row(partial: Partial<Row> & { id: string }): Row {
  return {
    user_id: "u_student",
    title: "Test",
    created_at: "2026-11-01T10:00:00.000Z",
    score: 0,
    total_marks: 0,
    subject_stats: {},
    assignment_id: null,
    exam_preset: null,
    is_malpractice: false,
    ...partial,
  };
}

function reset() {
  currentUser = { id: "u_student", role: "student" };
  flagOn = true;
  rows = [];
  pool.queries = [];
}

test("T3.1 flag off → every predictor endpoint answers 404 feature_off", async () => {
  reset();
  flagOn = false;
  for (const res of [await get("rank-predictor/attempts?exam=neet"), await get("rank-predictor/attempt/r1"), await post(NEET_BODY)]) {
    assert.equal(res.status, 404);
    assert.equal((await res.json()).code, "feature_off");
  }
});

test("T3.2 attempts without a session → 401 (edge policy authenticated + handler)", async () => {
  reset();
  assert.equal(getApiRoutePolicy("/api/assessments/rank-predictor/attempts").kind, "authenticated");
  currentUser = null;
  assert.equal((await get("rank-predictor/attempts?exam=neet")).status, 401);
});

test("T3.3 teacher → 403", async () => {
  reset();
  currentUser = { id: "u_teacher", role: "teacher" };
  assert.equal((await get("rank-predictor/attempts?exam=neet")).status, 403);
});

test("Other exams' full mocks are filtered in SQL, before the LIMIT", async () => {
  reset();
  rows = [row({ id: "r_jee", exam_preset: "jee-main", subject_stats: { physics: { score: 40, total_marks: 100 } } })];
  assert.deepEqual(await (await get("rank-predictor/attempts?exam=neet")).json(), []);
  const q = pool.matching("LIMIT")[0];
  assert.match(q.sql, /c\.exam_preset IS NULL OR c\.exam_preset = \$2/);
  assert.deepEqual(q.params, ["u_student", "neet"]);
});

test("T3.4 student with 0 attempts → []", async () => {
  reset();
  const res = await get("rank-predictor/attempts?exam=neet");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), []);
});

test("T3.5 NEET full mock with botany + zoology → Biology = sum, out of 360", async () => {
  reset();
  rows = [
    row({
      id: "r_neet",
      title: "NEET full mock",
      score: 500,
      total_marks: 720,
      exam_preset: "neet",
      subject_stats: {
        physics: { score: 120, total_marks: 180 },
        chemistry: { score: 110, total_marks: 180 },
        botany: { score: 140, total_marks: 180 },
        zoology: { score: 130, total_marks: 180 },
      },
    }),
  ];
  const list = await (await get("rank-predictor/attempts?exam=neet")).json();
  assert.equal(list.length, 1);
  assert.deepEqual(list[0].subjects.biology, { score: 270, outOf: 360 });
  assert.equal(list[0].kind, "full_mock");
  const fill = await (await get("rank-predictor/attempt/r_neet?exam=neet")).json();
  assert.equal(fill.marks.biology.value, 270);
  assert.equal(fill.marks.physics.value, 120);
  assert.ok(fill.preview.air.low >= 1, "full mock carries the one-line preview");
});

test("T3.6 subject_stats camelCase (totalMarks) and snake_case (total_marks) both read", async () => {
  reset();
  rows = [
    row({ id: "r_snake", exam_preset: "jee-main", subject_stats: { physics: { score: 40, total_marks: 100 }, chemistry: { score: 50, total_marks: 100 }, mathematics: { score: 60, total_marks: 100 } } }),
    row({ id: "r_camel", created_at: "2026-11-02T10:00:00.000Z", exam_preset: "jee-main", subject_stats: { physics: { score: 41, totalMarks: 100 }, chemistry: { score: 51, totalMarks: 100 }, mathematics: { score: 61, totalMarks: 100 } } }),
  ];
  const snake = await (await get("rank-predictor/attempt/r_snake?exam=jee-main")).json();
  const camel = await (await get("rank-predictor/attempt/r_camel?exam=jee-main")).json();
  assert.deepEqual([snake.marks.physics.value, snake.marks.chemistry.value, snake.marks.maths.value], [40, 50, 60]);
  assert.deepEqual([camel.marks.physics.value, camel.marks.chemistry.value, camel.marks.maths.value], [41, 51, 61]);
});

test("T3.7 is_malpractice attempt → not listed (and not fillable)", async () => {
  reset();
  rows = [row({ id: "r_bad", is_malpractice: true, exam_preset: "neet", subject_stats: { physics: { score: 100, total_marks: 180 } } })];
  assert.deepEqual(await (await get("rank-predictor/attempts?exam=neet")).json(), []);
  assert.equal((await get("rank-predictor/attempt/r_bad?exam=neet")).status, 404);
  assert.ok(pool.queries.every((q) => q.sql.includes("is_malpractice = FALSE")));
});

test("T3.8 attempt/:id for another user's result → 404 (not 403)", async () => {
  reset();
  rows = [row({ id: "r_other", user_id: "u_someone_else", exam_preset: "neet", subject_stats: { physics: { score: 100, total_marks: 180 } } })];
  const res = await get("rank-predictor/attempt/r_other?exam=neet");
  assert.equal(res.status, 404);
  const q = pool.matching("r.id = $1")[0];
  assert.deepEqual(q.params, ["r_other", "u_student"], "ownership is part of the query");
});

test("T3.9 Physics-only subject test 30/40 used for NEET → Physics 135/180 projected, other boxes empty", async () => {
  reset();
  rows = [row({ id: "r_phy", title: "Kinematics test", subject_stats: { physics: { score: 30, total_marks: 40 } } })];
  const fill = await (await get("rank-predictor/attempt/r_phy?exam=neet")).json();
  assert.deepEqual(Object.keys(fill.marks), ["physics"]);
  assert.equal(fill.marks.physics.value, 135);
  assert.equal(fill.marks.physics.how, "projected");
  assert.match(fill.marks.physics.note, /Projected from a Physics test/);
  assert.equal(fill.preview, null);
});

test("T3.10 average of last 3 full mocks with only 2 → uses 2 and says so", async () => {
  reset();
  rows = [
    row({ id: "m1", exam_preset: "neet", created_at: "2026-10-01T00:00:00Z", subject_stats: { physics: { score: 100, total_marks: 180 }, chemistry: { score: 100, total_marks: 180 }, biology: { score: 200, total_marks: 360 } } }),
    row({ id: "m2", exam_preset: "neet", created_at: "2026-10-08T00:00:00Z", subject_stats: { physics: { score: 120, total_marks: 180 }, chemistry: { score: 110, total_marks: 180 }, biology: { score: 300, total_marks: 360 } } }),
  ];
  const fill = await (await get("rank-predictor/average?exam=neet")).json();
  assert.equal(fill.marks.physics.value, 110);
  assert.equal(fill.marks.biology.value, 250);
  assert.ok(fill.notes.some((n: string) => /last 2 full mocks \(you have only 2\)/.test(n)));
});

test("T3.11 POST /api/public/rank-predictor without a valid JWT → counted as a visitor (Stage 3 opened it; was 401)", async () => {
  reset();
  currentUser = null;
  const res = await post(NEET_BODY);
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).access, { signedIn: false, remainingToday: 1, limit: 2 });
  assert.equal(getApiRoutePolicy("/api/public/rank-predictor").kind, "public");
});

test("T3.12 body > 2 KB, unknown keys, wrong enum → 400 with the field name", async () => {
  reset();
  const big = await post(null, JSON.stringify({ ...NEET_BODY, hp: "x".repeat(2100) }));
  assert.equal(big.status, 400);
  assert.equal((await big.json()).field, "body");

  const unknown = await post({ ...NEET_BODY, rank: 1 });
  assert.equal(unknown.status, 400);
  assert.equal((await unknown.json()).field, "rank");

  const nestedUnknown = await post({ ...NEET_BODY, marks: { ...NEET_BODY.marks, maths: 10 } });
  assert.equal((await nestedUnknown.json()).field, "marks.maths");

  const badEnum = await post({ ...NEET_BODY, category: "OBC" });
  assert.equal(badEnum.status, 400);
  assert.equal((await badEnum.json()).field, "category");

  const badShift = await post({ exam: "jee-main", marks: { maths: 50, physics: 50, chemistry: 50 }, category: "general", pwd: false, jeeMainShift: "2027-01-01-S1" });
  assert.equal((await badShift.json()).field, "jeeMainShift");

  const notJson = await post(null, "{not json");
  assert.equal(notJson.status, 400);
});

test("POST signed in → 200 with rounded ranges, sources, checked date, disclaimer, unlimited access", async () => {
  reset();
  const res = await post({ ...NEET_BODY, category: "obc-ncl", homeState: "Tamil Nadu" });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const body = await res.json();
  assert.ok(body.prediction.air.low >= 1);
  assert.equal(body.prediction.air.low % 100, 0, "ranges are rounded to nice numbers");
  assert.equal(body.prediction.stateRankStatus, "ok");
  assert.ok(body.sources.length > 0 && body.sources.every((s: { publisher: string; url: string }) => s.publisher && s.url.startsWith("https://")));
  assert.match(body.checkedOn, /^\d{2}\/\d{2}\/\d{4}$/);
  assert.match(body.disclaimer, /not a promise of a rank or a seat/);
  assert.deepEqual(body.access, { signedIn: true, remainingToday: null, limit: null });
});

test("The response never echoes category, PwD, gender or home state back as stored data", async () => {
  reset();
  const res = await post({ ...NEET_BODY, category: "sc", pwd: true, gender: "female", homeState: "Kerala" });
  const text = await res.text();
  assert.ok(!text.includes("female"));
  assert.ok(!/"category"|"homeState"|"gender"|"pwd"/.test(text));
});
