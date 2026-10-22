/**
 * Contest answer-key / paper-gate / waitlist hardening (bug-fix spec 04 —
 * C1, C2, C5). DB-free: the user + OGCode pools are fakes installed in the
 * globalThis pool slots, and the Redis caches are injected fakes (Node 20 has
 * no mock.module). Each fake pool records every query so the tests can assert
 * both the outcome AND that no answer-key lookup happened.
 */

import test from "node:test";
import assert from "node:assert/strict";

// Env BEFORE any server module loads (they are imported dynamically below):
// fake local URLs (never dialled — the pool slots are pre-filled) and no
// Upstash, so no module builds a real Redis client.
const FAKE_URL = "postgres://fake:fake@localhost:5/fake";
process.env.USER_DATABASE_URL = FAKE_URL;
process.env.OGCODE_DATABASE_URL = FAKE_URL;
delete process.env.USER_REPLICA_DATABASE_URL;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

type Row = Record<string, unknown>;
type Call = { sql: string; params: unknown[] };
type Handler = (sql: string, params: unknown[]) => Row[] | { rows: Row[]; rowCount: number } | undefined;

function fakePool(handler: Handler) {
  const calls: Call[] = [];
  const pool = {
    calls,
    async query(sql: string, params: unknown[] = []) {
      calls.push({ sql, params });
      const out = handler(sql, params) ?? [];
      return Array.isArray(out) ? { rows: out, rowCount: out.length } : out;
    },
    async end() {},
  };
  return pool;
}

function installPools(user: ReturnType<typeof fakePool>, ogcode?: ReturnType<typeof fakePool>) {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  (globalThis as any).__originUserPool = user;
  (globalThis as any).__originUserPoolConnectionString = FAKE_URL;
  (globalThis as any).__originOgcodePool = ogcode ?? fakePool(() => []);
  (globalThis as any).__originContestSchemaEnsured = true;
  (globalThis as any).__originOgcodeCatalogSchemaReady = Promise.resolve();
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

const HOUR = 3_600_000;
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

function contestRow(over: Row = {}): Row {
  return {
    id: "c1",
    name: "Weekly",
    subjects: ["Physics"],
    topics: { Physics: ["Kinematics"] },
    banner_url: null,
    reg_open: iso(-48 * HOUR),
    reg_close: iso(1 * HOUR),
    start_at: iso(1 * HOUR),
    end_at: iso(3 * HOUR),
    display_tz: "Asia/Kolkata",
    duration_seconds: 7200,
    scoring_config: null,
    ogcode_reward: 0,
    status: "scheduled",
    created_by: null,
    created_at: iso(-72 * HOUR),
    updated_at: iso(-72 * HOUR),
    published_at: iso(-72 * HOUR),
    access_mode: "open",
    registration_cap: null,
    ...over,
  };
}

/** User-pool router for the practice service. */
function practiceUserPool(contest: Row, opts: { onPaper?: boolean; paperIds?: string[] } = {}) {
  return fakePool((sql) => {
    if (/FROM contest\.registrations/.test(sql)) return [{ "?column?": 1 }];
    if (/FROM contest\.contests WHERE id/.test(sql)) return [contest];
    if (/FROM \(\s*SELECT DISTINCT cq\.question_id/.test(sql)) return opts.onPaper ? [{ "?column?": 1 }] : [];
    if (/SELECT DISTINCT cq\.question_id/.test(sql)) return (opts.paperIds ?? []).map((id) => ({ question_id: id }));
    if (/practice_progress/.test(sql)) return [];
    return [];
  });
}

function statusOf(err: unknown): number | undefined {
  return (err as { status?: number }).status;
}

// ---------------------------------------------------------------- C1 practice

test("C1: a question on a contest paper → 403, and the answer key is never looked up", async () => {
  const { recordPracticeAttempt } = await import("@/server/contest/contest-practice-service");
  const user = practiceUserPool(contestRow(), { onPaper: true });
  const ogcode = fakePool(() => []);
  installPools(user, ogcode);

  await assert.rejects(
    () => recordPracticeAttempt("c1", "u1", "paper_q", 1),
    (err) => statusOf(err) === 403 && /contest paper/i.test(String(err)),
  );
  assert.equal(ogcode.calls.length, 0, "no catalog (answer-key) read for a paper question");
});

test("C1: practice is closed (409) while LIVE / ENDED / RESULT_PROCESSING", async () => {
  const { recordPracticeAttempt, getPracticeQuestions } = await import(
    "@/server/contest/contest-practice-service"
  );
  const live = contestRow({ start_at: iso(-1 * HOUR), end_at: iso(1 * HOUR) });
  const ended = contestRow({ start_at: iso(-3 * HOUR), end_at: iso(-1 * HOUR) });
  const processing = contestRow({ status: "result_processing", start_at: iso(-3 * HOUR), end_at: iso(-1 * HOUR) });

  for (const row of [live, ended, processing]) {
    const ogcode = fakePool(() => []);
    installPools(practiceUserPool(row), ogcode);
    await assert.rejects(() => recordPracticeAttempt("c1", "u1", "q1", 0), (e) => statusOf(e) === 409);
    await assert.rejects(() => getPracticeQuestions("c1", "u1"), (e) => statusOf(e) === 409);
    assert.equal(ogcode.calls.length, 0, `no catalog read while ${String(row.status)}`);
  }
});

test("C1: assertPracticeOpen allows UPCOMING and RESULT_PUBLISHED", async () => {
  const { assertPracticeOpen } = await import("@/server/contest/contest-practice-service");
  const base = { regOpen: iso(-48 * HOUR), regClose: iso(HOUR), startAt: iso(HOUR), endAt: iso(3 * HOUR) };
  assert.doesNotThrow(() => assertPracticeOpen({ ...base, status: "scheduled" }));
  assert.doesNotThrow(() =>
    assertPracticeOpen({ ...base, status: "result_published", startAt: iso(-3 * HOUR), endAt: iso(-HOUR) }),
  );
});

test("C1: a hidden contest import (outside the practice pool) → 404", async () => {
  const { recordPracticeAttempt } = await import("@/server/contest/contest-practice-service");
  // The practice-pool filter excludes is_contest_import=TRUE AND
  // contest_practice_eligible=FALSE, so the real query returns no row.
  const ogcode = fakePool(() => []);
  installPools(practiceUserPool(contestRow()), ogcode);

  await assert.rejects(() => recordPracticeAttempt("c1", "u1", "hidden_import", 0), (e) => statusOf(e) === 404);
  assert.equal(ogcode.calls.length, 1);
  const { sql, params } = ogcode.calls[0];
  assert.match(sql, /\(is_contest_import = FALSE OR contest_practice_eligible = TRUE\)/);
  assert.match(sql, /id = ANY\(\$\d+::text\[\]\)/);
  assert.ok(params.some((p) => Array.isArray(p) && p.includes("hidden_import")), "resolved via includeIds");
  assert.match(sql, /LOWER\(question_type\) = 'mcq'/, "same MCQ-only filter as the listing");
});

test("C1: the practice listing excludes every unreleased paper question", async () => {
  const { getPracticeQuestions } = await import("@/server/contest/contest-practice-service");
  const ogcode = fakePool(() => []);
  installPools(practiceUserPool(contestRow(), { paperIds: ["p1", "p2"] }), ogcode);

  await getPracticeQuestions("c1", "u1");
  const page = ogcode.calls.find((c) => /FROM ogcode_questions/.test(c.sql));
  assert.ok(page);
  assert.match(page.sql, /NOT \(id = ANY\(\$\d+::text\[\]\)\)/);
  assert.ok(page.params.some((p) => Array.isArray(p) && p.includes("p1") && p.includes("p2")));
});

test("P10: the DPP answer endpoint is closed (409) while the contest runs, before any key lookup", async () => {
  const { gradeContestDppAnswer } = await import("@/server/contest/contest-dpp-service");
  const live = contestRow({ start_at: iso(-1 * HOUR), end_at: iso(1 * HOUR) });
  const processing = contestRow({ status: "result_processing", start_at: iso(-3 * HOUR), end_at: iso(-1 * HOUR) });
  for (const row of [live, processing]) {
    const user = practiceUserPool(row);
    const ogcode = fakePool(() => []);
    installPools(user, ogcode);
    await assert.rejects(() => gradeContestDppAnswer("c1", "u1", "q1", 0), (e) => statusOf(e) === 409);
    assert.equal(ogcode.calls.length, 0, `no catalog read while ${String(row.status)}`);
    assert.ok(!user.calls.some((c) => /submission_answers/.test(c.sql)), "the DPP is not even built");
  }
});

test("C1: getOgcodeCatalogQuestionById visibility clause (default stays 'all')", async () => {
  const { getOgcodeCatalogQuestionById } = await import("@/server/ogcode-catalog");
  const ogcode = fakePool(() => []);
  installPools(fakePool(() => []), ogcode);

  await getOgcodeCatalogQuestionById("q");
  await getOgcodeCatalogQuestionById("q", { visibility: "ogcode" });
  await getOgcodeCatalogQuestionById("q", { visibility: "practice" });
  const [all, og, practice] = ogcode.calls.map((c) => c.sql);
  assert.doesNotMatch(all, /is_contest_import/);
  assert.match(og, /AND is_contest_import = FALSE/);
  assert.match(practice, /AND \(is_contest_import = FALSE OR contest_practice_eligible = TRUE\)/);
});

test("C1: the paper payload carries no bank questionId and no answer key", async () => {
  const { sanitizeQuestion } = await import("@/server/contest/contest-paper-cache");
  const q = sanitizeQuestion({
    position: 3,
    question_id: "ogq_secret",
    subject: "Physics",
    section_id: null,
    snapshot: {
      text: "T",
      options: ["a", "b"],
      questionType: "mcq",
      correctOption: 1,
      correctOptions: [1],
      answerText: "b",
      tolerance: 0,
      explanation: "because",
    },
    marks: 4,
    negative_marks: 1,
  });
  for (const k of ["questionId", "question_id", "correctOption", "correctOptions", "answerText", "tolerance", "explanation"]) {
    assert.ok(!(k in q), `${k} must not be in the student paper`);
  }
  assert.ok(!JSON.stringify(q).includes("ogq_secret"));
  assert.equal(q.position, 3);
});

// -------------------------------------------------------------- C2 paper gate

function windowRow(over: Row = {}): Row {
  return {
    status: "scheduled",
    reg_open: iso(-48 * HOUR),
    reg_close: iso(HOUR),
    start_at: iso(HOUR),
    end_at: iso(3 * HOUR),
    ...over,
  };
}

function gateUserPool(window: Row, registrationRows: Row[]) {
  return fakePool((sql) => {
    if (/FROM contest\.contests WHERE id/.test(sql)) return [window];
    if (/FROM contest\.registrations/.test(sql)) return registrationRows;
    return [];
  });
}

async function resetCaches() {
  const wc = await import("@/server/contest/contest-window-cache");
  const rs = await import("@/server/contest/contest-registered-set");
  wc.__setWindowCacheRedisForTests(null);
  rs.__setRegisteredSetRedisForTests(null);
}

test("C2: the paper is refused before start_at (409), even for a registered user", async () => {
  await resetCaches();
  const { checkPaperAccess } = await import("@/server/contest/contest-paper-cache");
  installPools(gateUserPool(windowRow(), [{ "?column?": 1 }]));
  const res = await checkPaperAccess("c_upcoming", "u1");
  assert.deepEqual(res.ok, false);
  assert.equal(!res.ok && res.status, 409);
});

test("C2: LIVE + waitlisted → 403; LIVE + confirmed → ok; results published → ok", async () => {
  await resetCaches();
  const { checkPaperAccess } = await import("@/server/contest/contest-paper-cache");
  const live = windowRow({ start_at: iso(-HOUR), end_at: iso(HOUR) });

  // Waitlisted: the confirmed-only query returns no row.
  const waitlisted = gateUserPool(live, []);
  installPools(waitlisted);
  const denied = await checkPaperAccess("c_live_w", "u_wait");
  assert.equal(!denied.ok && denied.status, 403);
  const regQuery = waitlisted.calls.find((c) => /FROM contest\.registrations/.test(c.sql));
  assert.ok(regQuery);
  assert.match(regQuery.sql, /status = 'registered'/);
  assert.equal(regQuery.params[2], false, "includeWaitlisted is off for the paper gate");

  installPools(gateUserPool(live, [{ "?column?": 1 }]));
  assert.deepEqual(await checkPaperAccess("c_live_ok", "u1"), { ok: true });

  installPools(gateUserPool(windowRow({ status: "result_published", start_at: iso(-5 * HOUR), end_at: iso(-3 * HOUR) }), [{ "?column?": 1 }]));
  assert.deepEqual(await checkPaperAccess("c_published", "u1"), { ok: true });

  installPools(gateUserPool(windowRow({ start_at: iso(-3 * HOUR), end_at: iso(-HOUR) }), [{ "?column?": 1 }]));
  const ended = await checkPaperAccess("c_ended", "u1");
  assert.equal(!ended.ok && ended.status, 409, "ENDED without results → 409");
});

/** Fake Upstash for the window cache, including the generation-guarded Lua SET. */
function fakeWindowRedis() {
  const store = new Map<string, string>();
  const redis = {
    async get(k: string) { return store.get(k) ?? null; },
    async set(k: string, v: string) { store.set(k, v); return "OK"; },
    async del(k: string) { return store.delete(k) ? 1 : 0; },
    async incr(k: string) { const n = Number(store.get(k) ?? 0) + 1; store.set(k, String(n)); return n; },
    async eval(_script: string, keys: string[], args: string[]) {
      if ((store.get(keys[1]) ?? "0") !== args[0]) return 0;
      store.set(keys[0], args[1]);
      return 1;
    },
  };
  return { store, redis };
}

test("L4: a reader holding the pre-invalidation row cannot write it back to Redis", async () => {
  const wc = await import("@/server/contest/contest-window-cache");
  const { store, redis } = fakeWindowRedis();
  wc.__setWindowCacheRedisForTests(redis);

  // The admin's write + invalidation lands while the reader's DB read is in flight.
  let reads = 0;
  installPools(
    fakePool((sql) => {
      if (/FROM contest\.contests WHERE id/.test(sql)) {
        reads += 1;
        if (reads > 1) return [windowRow({ status: "cancelled" })];
        void wc.invalidateContestWindow("race"); // admin cancels mid-read
        return [windowRow({ status: "scheduled" })];
      }
      return [];
    }),
  );
  const first = await wc.getContestWindow("race");
  assert.equal(first?.status, "scheduled", "the in-flight reader still answers with what it read");
  assert.ok(!store.has("contest:race:window"), "but it must not repopulate Redis with the stale row");

  wc.__resetWindowCacheForTests();
  const second = await wc.getContestWindow("race");
  assert.equal(second?.status, "cancelled");
  assert.ok(store.has("contest:race:window"), "an uncontended read fills Redis again");
  wc.__setWindowCacheRedisForTests(null);
});

test("L5: the registered-set key is versioned so pre-fix sets (with waitlisted users) are never trusted", async () => {
  const rs = await import("@/server/contest/contest-registered-set");
  assert.equal(rs.registeredSetKey("c9"), "contest:c9:registered:v2");
  const { isRegisteredForContest } = await import("@/server/contest/contest-registration-service");
  const fake = fakeSetRedis();
  rs.__setRegisteredSetRedisForTests(fake.redis);
  fake.sets.set("contest:c9:registered", new Set(["u_wait"])); // left over from the old code
  installPools(fakePool((sql) => (/FROM contest\.registrations/.test(sql) ? [] : [])));
  assert.equal(await isRegisteredForContest("c9", "u_wait"), false, "old set ignored → Neon says not confirmed");
  rs.__setRegisteredSetRedisForTests(null);
});

test("L6: the paper refusal message matches the contest state", async () => {
  const { paperUnavailableDetail } = await import("@/server/contest/contest-paper-cache");
  assert.match(paperUnavailableDetail("UPCOMING"), /once the contest starts/);
  assert.match(paperUnavailableDetail("ENDED"), /has ended/);
  assert.match(paperUnavailableDetail("RESULT_PROCESSING"), /has ended/);
  assert.match(paperUnavailableDetail("CANCELLED"), /cancelled/);
});

test("C2: the window cache collapses repeat reads and invalidates through Redis", async () => {
  const wc = await import("@/server/contest/contest-window-cache");
  const { store, redis } = fakeWindowRedis();
  wc.__setWindowCacheRedisForTests(redis);
  const user = gateUserPool(windowRow(), []);
  installPools(user);

  const w1 = await wc.getContestWindow("cw");
  const w2 = await wc.getContestWindow("cw");
  assert.deepEqual(w1, w2);
  assert.equal(user.calls.length, 1, "second read served in-process");
  assert.ok(store.has("contest:cw:window"), "filled Redis");

  wc.__resetWindowCacheForTests();
  await wc.getContestWindow("cw");
  assert.equal(user.calls.length, 1, "in-process miss served from Redis");

  await wc.invalidateContestWindow("cw");
  assert.ok(!store.has("contest:cw:window"));
  await wc.getContestWindow("cw");
  assert.equal(user.calls.length, 2, "after invalidation the DB is read again");

  const w = wc.toContestWindow({ status: "scheduled", startAt: null, endAt: "bad", regOpen: null, regClose: null });
  assert.equal(w.startAt, null);
  assert.equal(w.endAt, null);
  wc.__setWindowCacheRedisForTests(null);
});

function fakeSetRedis() {
  const sets = new Map<string, Set<string>>();
  const ops: string[] = [];
  return {
    sets,
    ops,
    redis: {
      async sadd(k: string, m: string) { ops.push(`sadd ${k} ${m}`); (sets.get(k) ?? sets.set(k, new Set()).get(k)!).add(m); return 1; },
      async srem(k: string, m: string) { ops.push(`srem ${k} ${m}`); return sets.get(k)?.delete(m) ? 1 : 0; },
      async sismember(k: string, m: string) { return sets.get(k)?.has(m) ? 1 : 0; },
      async expire() { return 1; },
    },
  };
}

test("C2: unregister SREMs the registered-set so a warm cache can't keep paper access", async () => {
  const rs = await import("@/server/contest/contest-registered-set");
  const { unregisterParticipant } = await import("@/server/contest/contest-participant-actions-service");
  const { isRegisteredForContest } = await import("@/server/contest/contest-registration-service");
  const fake = fakeSetRedis();
  rs.__setRegisteredSetRedisForTests(fake.redis);
  fake.sets.set("contest:c1:registered:v2", new Set(["u1"]));

  let deleted = false;
  installPools(
    fakePool((sql) => {
      if (/FROM contest\.attempts/.test(sql)) return [];
      if (/DELETE FROM contest\.registrations/.test(sql)) { deleted = true; return { rows: [], rowCount: 1 }; }
      if (/SELECT access_mode, registration_cap/.test(sql)) return [{ access_mode: "open", registration_cap: null }];
      if (/FROM contest\.registrations/.test(sql)) return deleted ? [] : [{ "?column?": 1 }];
      return [];
    }),
  );

  assert.equal(await isRegisteredForContest("c1", "u1"), true);
  await unregisterParticipant("c1", "u1");
  assert.ok(fake.ops.includes("srem contest:c1:registered:v2 u1"));
  assert.equal(await fake.redis.sismember("contest:c1:registered:v2", "u1"), 0);
  assert.equal(await isRegisteredForContest("c1", "u1"), false, "falls through to Neon → not registered");
  rs.__setRegisteredSetRedisForTests(null);
});

test("C2: a waitlisted registration is never SADDed; a promotion is", async () => {
  const rs = await import("@/server/contest/contest-registered-set");
  const { registerForContest, isRegisteredForContest } = await import(
    "@/server/contest/contest-registration-service"
  );
  const { promoteFromWaitlist } = await import("@/server/contest/contest-access-service");
  const fake = fakeSetRedis();
  rs.__setRegisteredSetRedisForTests(fake.redis);

  installPools(
    fakePool((sql) => {
      if (/SELECT access_mode, registration_cap/.test(sql)) return [{ access_mode: "open", registration_cap: 1 }];
      if (/COUNT\(\*\)::int AS n/.test(sql)) return [{ n: 1 }];
      if (/INSERT INTO contest\.registrations/.test(sql)) return [{ registered_at: new Date(), status: "waitlisted" }];
      if (/SELECT status FROM contest\.registrations/.test(sql)) return [];
      if (/FROM contest\.registrations/.test(sql)) return [{ "?column?": 1 }]; // includeWaitlisted read
      return [];
    }),
  );
  const reg = await registerForContest("c1", "u_wait");
  assert.equal(reg.waitlisted, true);
  assert.equal(await isRegisteredForContest("c1", "u_wait", { includeWaitlisted: true }), true);
  await new Promise((r) => setImmediate(r));
  assert.ok(!fake.ops.some((o) => o.startsWith("sadd")), "no SADD for a waitlisted seat");

  installPools(
    fakePool((sql) => {
      if (/COUNT\(\*\)::int AS n/.test(sql)) return [{ n: 0 }];
      if (/UPDATE contest\.registrations SET status = 'registered'/.test(sql)) return [{ user_id: "u_wait" }];
      return [];
    }),
  );
  assert.equal(await promoteFromWaitlist("c1", 1), 1);
  await new Promise((r) => setImmediate(r));
  assert.ok(fake.ops.includes("sadd contest:c1:registered:v2 u_wait"), "promotion joins the cache");
  rs.__setRegisteredSetRedisForTests(null);
});

// ------------------------------------------------------------ C5 waitlisted

test("C5: a waitlisted user cannot start the rated attempt (code 'waitlisted')", async () => {
  const { startAttempt } = await import("@/server/contest/contest-attempt-service");
  const user = fakePool((sql) => {
    if (/INSERT INTO contest\.attempts/.test(sql)) return [];
    if (/FROM contest\.attempts/.test(sql)) return [];
    if (/SELECT status FROM contest\.registrations/.test(sql)) return [{ status: "waitlisted" }];
    return [];
  });
  installPools(user);

  await assert.rejects(
    () => startAttempt("c1", "u_wait"),
    (err) => statusOf(err) === 403 && (err as { code?: string }).code === "waitlisted",
  );
  const insert = user.calls.find((c) => /INSERT INTO contest\.attempts/.test(c.sql));
  assert.ok(insert);
  assert.match(insert.sql, /r\.status = 'registered'/, "start JOIN only admits confirmed seats");
});

test("C5: an unregistered user still gets 'not_registered'", async () => {
  const { startAttempt } = await import("@/server/contest/contest-attempt-service");
  installPools(fakePool(() => []));
  await assert.rejects(
    () => startAttempt("c1", "u_none"),
    (err) => (err as { code?: string }).code === "not_registered",
  );
});

// ------------------------------------------- C1 student by-id lookups (follow-up)

/**
 * OGCode pool that behaves like the real WHERE clause: the hidden contest
 * import exists, so it comes back ONLY when the lookup carries no visibility
 * clause ("all"). A student path that still used "all" would resolve it.
 */
function hiddenImportOgcodePool() {
  return fakePool((sql, params) => {
    if (!/FROM ogcode_questions/.test(sql) || params[0] !== "hidden_import") return [];
    if (/is_contest_import = FALSE/.test(sql)) return [];
    return [{ id: "hidden_import", text: "T", options: ["a", "b"], correct_option: 1, subject: "Physics" }];
  });
}

test("C1: OGCode practice detail + submit never resolve a hidden contest import by id", async () => {
  const { getPracticeQuestionDetail, submitPracticeQuestion } = await import("@/legacy/assessments");
  const ogcode = hiddenImportOgcodePool();
  installPools(fakePool(() => []), ogcode);
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const store = { questions: [], practiceAttempts: [] } as any;
  const user = { id: "u1", role: "student" } as any;
  /* eslint-enable @typescript-eslint/no-explicit-any */

  await assert.rejects(() => getPracticeQuestionDetail(store, user, "hidden_import"), /was not found/);
  await assert.rejects(
    () => submitPracticeQuestion(store, user, "hidden_import", { selectedOption: 1 } as never),
    /was not found/,
  );
  const lookups = ogcode.calls.filter((c) => /FROM ogcode_questions/.test(c.sql));
  assert.equal(lookups.length, 2);
  for (const c of lookups) assert.match(c.sql, /AND is_contest_import = FALSE/);
});

test("C1: the hidden import IS in the bank — only the 'all' (admin) lookup returns it", async () => {
  const { getOgcodeCatalogQuestionById } = await import("@/server/ogcode-catalog");
  installPools(fakePool(() => []), hiddenImportOgcodePool());
  assert.equal((await getOgcodeCatalogQuestionById("hidden_import"))?.id, "hidden_import");
  assert.equal(await getOgcodeCatalogQuestionById("hidden_import", { visibility: "ogcode" }), null);
});

// ------------------------------------------------- paper: matrix-match columns

test("paper: a matrix-match question carries its columns but never correct_pairs", async () => {
  const { sanitizeQuestion } = await import("@/server/contest/contest-paper-cache");
  const base = { position: 1, question_id: "ogq_m", subject: "Chemistry", section_id: null, marks: 4, negative_marks: 1 };
  const q = sanitizeQuestion({
    ...base,
    snapshot: {
      text: "Match List I with List II",
      options: null,
      questionType: "matrix_match",
      matrixData: { column_a: ["P", "Q"], column_b: ["1", "2", "3"], correct_pairs: [[0, 2], [1, 0]], secret: "x" },
      explanation: "because",
    },
  });
  assert.deepEqual(q.matrix, { column_a: ["P", "Q"], column_b: ["1", "2", "3"] });
  const json = JSON.stringify(q);
  assert.doesNotMatch(json, /correct_pairs|secret|because/);
  assert.ok(!("matrixData" in q));

  // Any other type gets no matrix block, even if a snapshot carries matrixData.
  const mcq = sanitizeQuestion({
    ...base,
    snapshot: { text: "T", options: ["a"], questionType: "mcq", matrixData: { column_a: ["P"], column_b: ["1"], correct_pairs: [[0, 0]] } },
  });
  assert.equal(mcq.matrix, null);
});

// ---------------------------------------------------------- C5 migration runner

test("C5: the confirmed-registration index migration is registered, after contest_core", async () => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const root = new URL("../..", import.meta.url).pathname;
  const runner = readFileSync(join(root, "scripts/run-migrations.mjs"), "utf8");
  const file = "20261021_contest_registrations_confirmed_idx.sql";
  assert.match(runner, new RegExp(`\\{ file: "${file.replace(/\./g, "\\.")}", target: "user" \\}`));
  assert.ok(runner.indexOf(file) > runner.indexOf("20260819_contest_core.sql"), "must apply after contest.registrations exists");
});
