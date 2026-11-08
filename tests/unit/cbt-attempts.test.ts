/**
 * Phase 8 (CBT) — sanitized-delivery + grading guards. Pure functions, so this
 * runs in test:unit without a database. The sanitization test is the security
 * gate: the student payload must never carry answers/explanations.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  cbtDeadlineExpired,
  gradeCbtLocal,
  finalizeExpiredRoom,
  GRADING_LEASE_SECONDS,
  GRADING_MAX_ATTEMPTS,
  GRADING_RETRY_BACKOFF_SECONDS,
  regradePendingParticipants,
  retryParticipantGrading,
  STUCK_PENDING_GRADING_SECONDS,
  TEACHER_RETRYABLE_GRADING_SQL,
  sanitizeQuestionForStudent,
  saveAnswers,
  submitAttempt,
  type TestQuestionRow,
} from "@/server/cbt/cbt-attempts-service";
import type { CbtQuestionAnswer } from "@/lib/cbt/question-model";
import type { CbtParticipant, CbtRoom } from "@/lib/cbt/room-model";
import { createPostgresPoolConfig } from "@/server/postgres-config";
import { finalizeIfExpired } from "@/server/cbt/cbt-rooms-service";

const FORBIDDEN_KEYS = [
  "answer",
  "answerText",
  "answer_text",
  "correctOption",
  "correct_option",
  "correctOptions",
  "correct_options",
  "correct_pairs",
  "correctPairs",
  "explanation",
  "tolerance",
];

function deepScanForForbiddenKeys(value: unknown, path = "$"): string[] {
  const hits: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((v, i) => hits.push(...deepScanForForbiddenKeys(v, `${path}[${i}]`)));
  } else if (value && typeof value === "object") {
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.includes(key)) hits.push(`${path}.${key}`);
      hits.push(...deepScanForForbiddenKeys(v, `${path}.${key}`));
    }
  }
  return hits;
}

function makeQuestion(over: Partial<TestQuestionRow>): TestQuestionRow {
  return {
    position: 1,
    questionId: "cbtq_1",
    questionType: "mcq",
    stem: "What is 2 + 2?",
    image: null,
    options: [{ text: "3" }, { text: "4" }, { text: "5" }],
    answer: { correctOption: 1, explanation: "obvious" } as CbtQuestionAnswer,
    explanation: "because arithmetic",
    subject: "Mathematics",
    chapter: "Basics",
    marks: 4,
    negativeMarks: -1,
    ...over,
  };
}

test("Phase 8: sanitized MCQ payload deep-scans clean of forbidden keys", () => {
  const out = sanitizeQuestionForStudent(makeQuestion({}));
  const hits = deepScanForForbiddenKeys(out);
  assert.deepEqual(hits, [], `sanitized payload leaked: ${hits.join(", ")}`);
  assert.deepEqual(out.options, [
    { text: "3", image: null },
    { text: "4", image: null },
    { text: "5", image: null },
  ]);
  assert.equal(out.marks, 4);
});

test("sanitized options carry per-option images through to the student", () => {
  const out = sanitizeQuestionForStudent(
    makeQuestion({ options: [{ text: "A", image: "https://cdn/o1.png" }, { text: "", image: "https://cdn/o2.png" }] }),
  );
  assert.deepEqual(out.options, [
    { text: "A", image: "https://cdn/o1.png" },
    { text: "", image: "https://cdn/o2.png" },
  ]);
});

test("Phase 8: sanitized matrix_match strips correct_pairs but keeps display rows", () => {
  const q = makeQuestion({
    questionType: "matrix_match",
    answer: {
      matrixData: { rows: ["A", "B"], columns: ["P", "Q"], correct_pairs: [[0, 1]] },
    } as CbtQuestionAnswer,
  });
  const out = sanitizeQuestionForStudent(q);
  const hits = deepScanForForbiddenKeys(out);
  assert.deepEqual(hits, [], `matrix leaked: ${hits.join(", ")}`);
  assert.ok(out.matrixData, "matrix display data present");
  assert.deepEqual(out.matrixData?.rows, ["A", "B"]);
  assert.equal((out.matrixData as Record<string, unknown>).correct_pairs, undefined);
});

test("Phase 8: MCQ grading — correct/incorrect/unattempted scoring", () => {
  const answer: CbtQuestionAnswer = { correctOption: 1 };
  assert.equal(gradeCbtLocal("mcq", answer, { selectedOption: 1 }, 4, -1).marksAwarded, 4);
  assert.equal(gradeCbtLocal("mcq", answer, { selectedOption: 0 }, 4, -1).marksAwarded, -1);
  assert.equal(gradeCbtLocal("mcq", answer, {}, 4, -1).marksAwarded, 0);
});

test("Phase 8: MSQ partial credit + numerical tolerance", () => {
  const msq: CbtQuestionAnswer = { correctOptions: [0, 1, 2] };
  assert.equal(gradeCbtLocal("msq", msq, { selectedOptions: [0, 1, 2] }, 4, -1).marksAwarded, 4);
  // subset → partial credit (2/3 * 4)
  const partial = gradeCbtLocal("msq", msq, { selectedOptions: [0, 1] }, 4, -1);
  assert.ok(partial.marksAwarded > 0 && partial.marksAwarded < 4);
  // superset (wrong option) → not a subset → negative
  assert.equal(gradeCbtLocal("msq", msq, { selectedOptions: [0, 3] }, 4, -1).marksAwarded, -1);

  const num: CbtQuestionAnswer = { answerText: "9.8", tolerance: 0.1 };
  assert.equal(gradeCbtLocal("numerical", num, { answerText: "9.85" }, 4, -1).marksAwarded, 4);
  assert.equal(gradeCbtLocal("numerical", num, { answerText: "12" }, 4, -1).marksAwarded, -1);
});

test("Phase 8: subjective is flagged for review, never auto-scored", () => {
  const out = gradeCbtLocal("subjective", { answerText: "an essay" } as CbtQuestionAnswer, { answerText: "my essay" }, 4, 0);
  assert.equal(out.marksAwarded, 0);
  assert.equal(out.needsReview, true);
});

// --- Bug fixes G2/G3 for the CBT local grader (docs/bug-fixes/03-grading-points.md) ---

test("G2: CBT numerical reads ONE strict number — fractions/scientific accepted, multi-number wrong", () => {
  const grade = (expected: string, submitted: string, tolerance: number | null = 0) =>
    gradeCbtLocal("numerical", { answerText: expected, tolerance } as CbtQuestionAnswer, { answerText: submitted }, 4, -1);
  // Used to grade as 3, 1 and 2 ("first number wins").
  assert.equal(grade("3", "3/4").marksAwarded, -1);
  assert.equal(grade("1", "1×10^-3").marksAwarded, -1);
  assert.equal(grade("2", "2 3").marksAwarded, -1);
  assert.equal(grade("2", "2 or 3").marksAwarded, -1);
  assert.equal(grade("2", "2,3").marksAwarded, -1);
  // The same notations now read as their real value.
  assert.equal(grade("0.75", "3/4").marksAwarded, 4);
  assert.equal(grade("0.001", "1×10^-3").marksAwarded, 4);
  assert.equal(grade("0.001", "1x10^-3").marksAwarded, 4);
  assert.equal(grade("0.001", "1E-3").marksAwarded, 4);
  assert.equal(grade("-5", "−5").marksAwarded, 4);
  assert.equal(grade("1000", "1,000").marksAwarded, 4);
  assert.equal(grade("100000", "1,00,000").marksAwarded, 4);
  // Plain numbers are unchanged.
  assert.equal(grade("42", "42").marksAwarded, 4);
  assert.equal(grade("9.8", "9.80").marksAwarded, 4);
  assert.equal(grade("-2500", "-2.5e3").marksAwarded, 4);
  assert.equal(grade("42", "41").marksAwarded, -1);
  assert.equal(grade("42", "").marksAwarded, 0);
  assert.equal(grade("42", "abc").marksAwarded, -1);
});

test("G2: CBT keeps its unit handling (label only) and its tolerance rule", () => {
  const units: CbtQuestionAnswer = { answerText: "9.8", units: "m/s^2", tolerance: 0 };
  assert.equal(gradeCbtLocal("numerical_with_units", units, { answerText: "9.8 m/s^2" }, 4, -1).marksAwarded, 4);
  assert.equal(gradeCbtLocal("numerical_with_units", units, { answerText: "9.8" }, 4, -1).marksAwarded, 4);
  assert.equal(gradeCbtLocal("numerical_with_units", units, { answerText: "9.8 m/s^2 or 10 m/s^2" }, 4, -1).marksAwarded, -1);
  const farad: CbtQuestionAnswer = { answerText: "0.0015", units: "F", tolerance: 0 };
  assert.equal(gradeCbtLocal("numerical_with_units", farad, { answerText: "1.5×10^-3 F" }, 4, -1).marksAwarded, 4);
  // P6: no stored tolerance ⇒ the grader's rule, not 1%: an integer key is exact
  // and a decimal key is exact after rounding to the key's decimal places.
  const integerKey: CbtQuestionAnswer = { answerText: "250" };
  assert.equal(gradeCbtLocal("numerical", integerKey, { answerText: "250" }, 4, -1).marksAwarded, 4);
  assert.equal(gradeCbtLocal("numerical", integerKey, { answerText: "252" }, 4, -1).marksAwarded, -1);
  const decimalKey: CbtQuestionAnswer = { answerText: "9.80 m/s^2" };
  assert.equal(gradeCbtLocal("numerical", decimalKey, { answerText: "9.8" }, 4, -1).marksAwarded, 4);
  assert.equal(gradeCbtLocal("numerical", decimalKey, { answerText: "9.804" }, 4, -1).marksAwarded, 4);
  assert.equal(gradeCbtLocal("numerical", decimalKey, { answerText: "9.81" }, 4, -1).marksAwarded, -1);
  // Float noise at the tolerance edge no longer flips the result.
  assert.equal(gradeCbtLocal("numerical", { answerText: "9.8", tolerance: 0.1 }, { answerText: "9.9" }, 4, -1).marksAwarded, 4);
  // An unparseable answer key is held for review with no marks.
  const broken = gradeCbtLocal("numerical", { answerText: "about five" }, { answerText: "5" }, 4, -1);
  assert.deepEqual(broken, { marksAwarded: 0, isCorrect: false, needsReview: true });
});

test("G3: CBT matrix-match — every cell ticked is wrong; partial credit per complete row", () => {
  const answer = { matrixData: { rows: ["A", "B"], cols: ["1", "2"], correct_pairs: [[0, 1], [1, 0]] } } as CbtQuestionAnswer;
  assert.equal(gradeCbtLocal("matrix_match", answer, { matrixPairs: [[1, 0], [0, 1]] }, 4, -1).marksAwarded, 4);
  assert.equal(gradeCbtLocal("matrix_match", answer, { matrixPairs: [[0, 0], [0, 1], [1, 0], [1, 1]] }, 4, -1).marksAwarded, -1);
  assert.equal(gradeCbtLocal("matrix_match", answer, { matrixPairs: [[0, 1]] }, 4, -1).marksAwarded, 2);
  assert.equal(gradeCbtLocal("matrix_match", answer, { matrixPairs: [[0, 1], [1, 1]] }, 4, -1).marksAwarded, -1);
  assert.equal(gradeCbtLocal("matrix_match", answer, {}, 4, -1).marksAwarded, 0);
  // M4 (P7): correct pairs only, no complete row ⇒ 0 (the grader's rule), never negative.
  const twoCells = { matrixData: { rows: ["A", "B"], cols: ["1", "2"], correct_pairs: [[0, 0], [0, 1], [1, 0]] } } as CbtQuestionAnswer;
  assert.equal(gradeCbtLocal("matrix_match", twoCells, { matrixPairs: [[0, 1]] }, 4, -1).marksAwarded, 0);
  assert.equal(gradeCbtLocal("matrix_match", twoCells, { matrixPairs: [[0, 1], [1, 1]] }, 4, -1).marksAwarded, -1);
});

// Shared grading-parity fixture (the file grader-service also runs): the parse
// table and every numeric/matrix case whose expectation does not depend on the
// G1 tolerance (P6): CBT uses the grader's rule — stored tolerance, else integer keys exact and
// decimal keys exact after rounding to the key's decimals.
type ParityCase = {
  id: string;
  question: { answerText?: string | null; tolerance?: number | null; matrixData?: Record<string, unknown> | null };
  answer: { answerText?: string | null; matrixPairs?: number[][] | null };
  expect: { isCorrect: boolean; marksAwarded: number; needsReview: boolean };
};
const parity = JSON.parse(readFileSync(new URL("../fixtures/grading-parity.json", import.meta.url), "utf8")) as {
  parseStrictNumber: [string | null, number | null][];
  cases: ParityCase[];
};

test("parity fixture: CBT number parsing matches parseStrictNumber's table", () => {
  for (const [raw, value] of parity.parseStrictNumber) {
    const graded = gradeCbtLocal("numerical", { answerText: String(value ?? 0), tolerance: 0 }, { answerText: raw }, 4, -1);
    assert.equal(graded.isCorrect, value !== null, `${JSON.stringify(raw)} → ${value}`);
  }
});

const CBT_PARITY_CASES: Record<string, "fixture"> = {
  "G1-tolerance-zero-is-exact": "fixture",
  "G1-explicit-0.1-accepts-9.75": "fixture",
  "G2-fraction-is-right": "fixture",
  "G2-times-ten-power-is-right": "fixture",
  "G2-upper-E-is-right": "fixture",
  "G2-two-numbers-is-wrong": "fixture",
  "G2-two-or-three-is-wrong": "fixture",
  "G2-expected-not-numeric-holds-for-review": "fixture",
  "G2-units-same-unit-is-right": "fixture",
  "G2-units-wrong-magnitude-is-wrong": "fixture",
  // CBT never compares units: a bare magnitude is compared with the key's (M1).
  "M1-units-bare-number-is-right": "fixture",
  // P6: a NULL tolerance follows the grader's integer / decimal-exact rule, not 1%.
  "G1-250-vs-252-is-wrong": "fixture",
  "G1-250-vs-250-is-right": "fixture",
  "G1-decimal-rounds-to-expected-places": "fixture",
  "G1-decimal-9.74-is-wrong": "fixture",
  "F7-fraction-key-three-decimals-is-right": "fixture",
  "F7-fraction-key-one-decimal-is-wrong": "fixture",
  "F7-terminating-fraction-key-rounded-is-wrong": "fixture",
  "F7-terminating-fraction-key-3-4-is-right": "fixture",
  // P7 / M4: correct pairs with no complete row are 0, not negative.
  "M4-one-correct-pair-no-complete-row-is-zero": "fixture",
  "G3-all-cells-ticked-is-negative": "fixture",
  "G3-one-row-complete-is-half": "fixture",
  "G3-subset-plus-wrong-pair-is-negative": "fixture",
  "G3-half-marked-row-earns-nothing-for-that-row": "fixture",
  "G3-exact-match": "fixture",
  "G3-unattempted": "fixture",
};

test("parity fixture: the applicable numeric + matrix cases grade the same in CBT", () => {
  const byId = new Map(parity.cases.map((c) => [c.id, c]));
  for (const id of Object.keys(CBT_PARITY_CASES)) {
    const c = byId.get(id);
    assert.ok(c, `fixture case ${id} exists`);
    const type = c.question.matrixData ? "matrix_match" : "numerical";
    const answer = {
      answerText: c.question.answerText ?? undefined,
      tolerance: c.question.tolerance ?? null,
      matrixData: c.question.matrixData ?? undefined,
    } as CbtQuestionAnswer;
    const out = gradeCbtLocal(type, answer, { answerText: c.answer.answerText, matrixPairs: c.answer.matrixPairs }, 4, -1);
    assert.equal(out.isCorrect, c.expect.isCorrect, `${id} isCorrect`);
    assert.equal(out.marksAwarded, c.expect.marksAwarded, `${id} marks`);
    assert.equal(out.needsReview, c.expect.needsReview, `${id} needsReview`);
  }
});

// ── C6 / C4: grading status + room time window (fake pool, no database) ─────

delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

type FakeParticipantRow = {
  finished_at: Date | null;
  auto_submitted: boolean;
  finalize_reason: string | null;
  grading_status: "pending" | "done" | "failed";
  grading_attempts: number;
  grading_error: string | null;
  /** Fake-clock ms of `grading_next_attempt_at`; null = due now. */
  grading_next_attempt_at: number | null;
  score: number | null;
  /** Stand-in for `finished_at < NOW() - 20s` in the regrade sweep. */
  aged: boolean;
  /** Stand-in for `finished_at < NOW() - 60s` (STUCK_PENDING_GRADING_SECONDS) in the teacher retry. */
  stuck: boolean;
};

const ROOM_ID = "cbtroom_test";
const PARTICIPANT_ID = "cbtp_test";

/**
 * Minimal stand-in for the user Postgres pool. Routes each statement by a
 * distinctive fragment of its SQL and models the one participant row the
 * grading paths touch. Anything unrecognised returns no rows.
 */
class FakeCbtDb {
  row: FakeParticipantRow = {
    finished_at: null,
    auto_submitted: false,
    finalize_reason: null,
    grading_status: "done",
    grading_attempts: 0,
    grading_error: null,
    grading_next_attempt_at: null,
    score: null,
    aged: false,
    stuck: false,
  };
  windowOpen = true;
  /** How many more times loading the paper (inside grading) should throw. */
  gradingFailuresLeft = 0;
  statements: string[] = [];
  /** Fake database clock (`NOW()`), in ms; `advance` moves it. */
  now = Date.now();

  advance(seconds: number): void {
    this.now += seconds * 1000;
  }

  /** Seconds until the row's next attempt is due (0 when due). */
  dueInSeconds(): number {
    const next = this.row.grading_next_attempt_at;
    return next === null ? 0 : Math.max(0, Math.round((next - this.now) / 1000));
  }

  query(sql: string, params: unknown[] = []): { rows: Record<string, unknown>[] } {
    this.statements.push(sql);
    const row = this.row;
    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql.trim())) return { rows: [] };
    if (sql.includes("AS open") && sql.includes("FROM cbt.rooms")) return { rows: [{ open: this.windowOpen }] };
    if (sql.includes("SELECT finished_at, grading_status FROM cbt.room_participants")) {
      return { rows: [{ finished_at: row.finished_at, grading_status: row.grading_status }] };
    }
    if (sql.includes("SELECT grading_status FROM cbt.room_participants")) {
      return { rows: [{ grading_status: row.grading_status }] };
    }
    if (sql.includes("SET finished_at = NOW()")) {
      row.finished_at = new Date();
      row.auto_submitted = Boolean(params[2]);
      row.finalize_reason = String(params[3]);
      row.grading_status = params[5] ? "pending" : "done";
      row.grading_attempts = 0;
      row.grading_error = null;
      row.grading_next_attempt_at = null;
      return { rows: [] };
    }
    if (sql.includes("SELECT answers, times FROM cbt.answer_drafts")) {
      return { rows: [{ answers: { 1: { selectedOption: 1 } }, times: {} }] };
    }
    if (sql.includes("FROM cbt.test_questions tq")) {
      if (this.gradingFailuresLeft > 0) {
        this.gradingFailuresLeft -= 1;
        throw new Error("connection terminated unexpectedly");
      }
      return {
        rows: [
          {
            position: 1,
            marks: 4,
            negative_marks: -1,
            question_id: "cbtq_1",
            question_type: "mcq",
            stem: "2 + 2?",
            image: null,
            options: [{ text: "3" }, { text: "4" }],
            answer: { correctOption: 1 },
            explanation: null,
            subject: "Mathematics",
            chapter: null,
          },
        ],
      };
    }
    if (sql.includes("SET score = $3")) {
      row.score = Number(params[2]);
      row.grading_status = "done";
      row.grading_error = null;
      return { rows: [] };
    }
    if (sql.includes("SET grading_attempts = grading_attempts + 1")) {
      if (row.grading_status !== "pending") return { rows: [] };
      const backoff = params[4] as number[];
      row.grading_next_attempt_at = this.now + backoff[Math.min(row.grading_attempts + 1, backoff.length) - 1] * 1000;
      row.grading_attempts += 1;
      row.grading_error = String(params[2]);
      row.grading_status = row.grading_attempts >= Number(params[3]) ? "failed" : "pending";
      return { rows: [{ grading_status: row.grading_status }] };
    }
    if (sql.includes("FOR UPDATE SKIP LOCKED")) {
      // The regrade sweep's lease: due, past the in-flight window, still pending.
      const due = row.grading_next_attempt_at === null || row.grading_next_attempt_at <= this.now;
      if (row.grading_status !== "pending" || !row.aged || !due) return { rows: [] };
      row.grading_next_attempt_at = this.now + Number(params[3]) * 1000;
      return { rows: [{ id: PARTICIPANT_ID, room_id: ROOM_ID, student_code: "S1", finished_at: row.finished_at }] };
    }
    if (sql.includes("SET grading_next_attempt_at = NULL")) {
      if (row.grading_status === "pending") row.grading_next_attempt_at = null;
      return { rows: [] };
    }
    if (sql.includes("SET grading_status = 'pending', grading_attempts = 0")) {
      const retryable =
        row.grading_status === "failed" || (row.grading_status === "pending" && row.stuck);
      if (!retryable || !row.finished_at) return { rows: [] };
      row.grading_status = "pending";
      row.grading_attempts = 0;
      row.grading_error = null;
      row.grading_next_attempt_at = this.now + Number(params[2]) * 1000;
      return { rows: [{ student_code: "S1" }] };
    }
    if (sql.includes("FROM cbt.rooms WHERE id")) return { rows: [fakeRoomRow()] };
    if (sql.includes("COUNT(*) FILTER")) return { rows: [{ pending: 0 }] };
    return { rows: [] };
  }

  asPool() {
    const run = async (sql: string, params?: unknown[]) => this.query(sql, params);
    return {
      query: run,
      connect: async () => ({ query: run, release: () => undefined }),
      end: async () => undefined,
    };
  }
}

function fakeRoomRow(): Record<string, unknown> {
  return {
    id: ROOM_ID,
    teacher_id: "cbtt_1",
    name: "Mock",
    public_slug: "mock",
    status: "in_test",
    test_id: "cbtt_test",
    started_at: new Date(Date.now() - 60_000),
    duration_seconds: 3600,
    ended_at: null,
    capacity: 200,
    rejoin_policy: "name_or_id",
    report_share_enabled: false,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

function fakeRoom(): CbtRoom {
  const now = new Date().toISOString();
  return {
    id: ROOM_ID,
    teacherId: "cbtt_1",
    name: "Mock",
    publicSlug: "mock",
    status: "in_test",
    testId: "cbtt_test",
    startedAt: new Date(Date.now() - 60_000).toISOString(),
    durationSeconds: 3600,
    endedAt: null,
    capacity: 200,
    rejoinPolicy: "name_or_id",
    reportShareEnabled: false,
    createdAt: now,
    updatedAt: now,
  };
}

function fakeParticipant(): CbtParticipant {
  return {
    id: PARTICIPANT_ID,
    roomId: ROOM_ID,
    displayName: "Student",
    studentCode: "S1",
    status: "giving_test",
    joinedAt: new Date().toISOString(),
    enteredTestAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    finishedAt: null,
    autoSubmitted: false,
    finalizeReason: null,
    rejoinCount: 0,
    lastRejoinAt: null,
    violationCount: 0,
    answeredCount: 1,
    score: null,
    maxScore: null,
    rank: null,
    timeTakenSeconds: null,
  };
}

/** Points getUserPostgresPool() at a fresh fake through its globalThis slots. */
function installFakeDb(): FakeCbtDb {
  const db = new FakeCbtDb();
  const url = "postgres://fake:fake@localhost:5432/fake";
  process.env.USER_DATABASE_URL = url;
  globalThis.__originUserPool = db.asPool() as never;
  globalThis.__originUserPoolConnectionString = createPostgresPoolConfig(url, 25).connectionString;
  globalThis.__originCbtSchemaEnsured = true;
  return db;
}

test("C6: a grading failure after the claim leaves the attempt 'pending' and the sweep grades it", async () => {
  const db = installFakeDb();
  db.gradingFailuresLeft = 1;
  const errors = console.error;
  console.error = () => undefined;
  try {
    const first = await submitAttempt(fakeParticipant(), fakeRoom(), { reason: "manual" });
    // Recorded, not thrown: the student is told "submitted", which is true.
    assert.equal(first.alreadySubmitted, false);
    assert.equal(first.gradingStatus, "pending");
    assert.equal(first.score, undefined);
    assert.ok(db.row.finished_at, "the claim committed");
    assert.equal(db.row.score, null);
    assert.equal(db.row.grading_status, "pending");
    assert.equal(db.row.grading_attempts, 1);
    assert.match(db.row.grading_error ?? "", /connection terminated/);

    // A retried submit is not a silent dead end: it reports grading is owed.
    const again = await submitAttempt(fakeParticipant(), fakeRoom(), { reason: "manual" });
    assert.deepEqual(again, { alreadySubmitted: true, gradingStatus: "pending" });

    // A fresh claim is left alone (it may still be grading in-flight)...
    assert.deepEqual(await regradePendingParticipants(), { regraded: 0, failed: 0 });
    // ...and picked up once it is older than the in-flight window and its
    // first backoff (L7) has passed.
    db.row.aged = true;
    assert.equal(db.dueInSeconds(), 30);
    db.advance(30);
    assert.deepEqual(await regradePendingParticipants(), { regraded: 1, failed: 0 });
    assert.equal(db.row.grading_status, "done");
    assert.equal(db.row.grading_error, null);
    assert.equal(db.row.score, 4);
    assert.ok(db.statements.some((sql) => sql.includes("WITH ranked")), "ranks re-persisted after the regrade");
  } finally {
    console.error = errors;
  }
});

test("C6: grading gives up after GRADING_MAX_ATTEMPTS as 'failed'; a teacher retry grades it", async () => {
  const db = installFakeDb();
  db.gradingFailuresLeft = 100;
  db.row.aged = true;
  const errors = console.error;
  console.error = () => undefined;
  try {
    await submitAttempt(fakeParticipant(), fakeRoom(), { reason: "timer" });
    assert.equal(db.row.grading_attempts, 1);
    for (let i = 1; i < GRADING_MAX_ATTEMPTS; i += 1) {
      db.advance(db.dueInSeconds());
      await regradePendingParticipants();
    }
    assert.equal(db.row.grading_attempts, GRADING_MAX_ATTEMPTS);
    assert.equal(db.row.grading_status, "failed");
    assert.equal(db.row.score, null);

    // Parked: the sweep no longer retries it.
    db.advance(24 * 3600);
    assert.deepEqual(await regradePendingParticipants(), { regraded: 0, failed: 0 });

    db.gradingFailuresLeft = 0;
    const retried = await retryParticipantGrading(ROOM_ID, PARTICIPANT_ID);
    assert.equal(retried.found, true);
    assert.equal(retried.gradingStatus, "done");
    assert.equal(retried.score, 4);
    assert.equal(db.row.grading_status, "done");
    assert.equal(db.row.score, 4);
  } finally {
    console.error = errors;
  }
});

test("L7: a failed regrade waits out an exponential backoff before the next try", async () => {
  const db = installFakeDb();
  db.gradingFailuresLeft = 100;
  db.row.aged = true;
  const errors = console.error;
  console.error = () => undefined;
  try {
    await submitAttempt(fakeParticipant(), fakeRoom(), { reason: "timer" });
    assert.equal(db.row.grading_attempts, 1);
    assert.deepEqual([...GRADING_RETRY_BACKOFF_SECONDS], [30, 120, 480, 1800, 7200]);
    for (let attempt = 1; attempt < GRADING_MAX_ATTEMPTS; attempt += 1) {
      const wait = GRADING_RETRY_BACKOFF_SECONDS[attempt - 1];
      assert.equal(db.dueInSeconds(), wait, `backoff after failure ${attempt}`);
      // Polled over and over before it is due (a busy dashboard, many instances): no try is spent.
      for (let poll = 0; poll < 5; poll += 1) {
        assert.deepEqual(await regradePendingParticipants(), { regraded: 0, failed: 0 });
      }
      db.advance(wait - 1);
      assert.deepEqual(await regradePendingParticipants(), { regraded: 0, failed: 0 });
      assert.equal(db.row.grading_attempts, attempt);
      db.advance(1);
      assert.deepEqual(await regradePendingParticipants(), { regraded: 0, failed: 1 });
      assert.equal(db.row.grading_attempts, attempt + 1);
    }
    assert.equal(db.row.grading_status, "failed");
  } finally {
    console.error = errors;
  }
});

test("L7: a row being regraded is leased, so a concurrent sweep skips it", async () => {
  const db = installFakeDb();
  db.gradingFailuresLeft = 1;
  db.row.aged = true;
  const errors = console.error;
  console.error = () => undefined;
  try {
    await submitAttempt(fakeParticipant(), fakeRoom(), { reason: "timer" });
    db.advance(db.dueInSeconds());
    const first = regradePendingParticipants();
    // The first sweep has leased the row before the second one looks.
    const second = await regradePendingParticipants();
    assert.deepEqual(second, { regraded: 0, failed: 0 });
    assert.deepEqual(await first, { regraded: 1, failed: 0 });
    assert.equal(db.row.grading_status, "done");
    assert.ok(GRADING_LEASE_SECONDS * 1000 > 40_000, "the lease outlives a sweep's budget");
  } finally {
    console.error = errors;
  }
});

test("L7: student reads never regrade inline; teacher reads do", async () => {
  const db = installFakeDb();
  db.gradingFailuresLeft = 1;
  db.row.aged = true;
  const errors = console.error;
  console.error = () => undefined;
  try {
    await submitAttempt(fakeParticipant(), fakeRoom(), { reason: "timer" });
    db.advance(db.dueInSeconds());
    const leased = () => db.statements.filter((sql) => sql.includes("FOR UPDATE SKIP LOCKED")).length;

    // Student state poll / public report (no `regrade`), forced or not.
    await finalizeIfExpired({ id: "cbtroom_student_poll", status: "in_test" });
    await finalizeExpiredRoom(ROOM_ID, { force: true });
    assert.equal(leased(), 0, "no regrade on a student read");
    assert.equal(db.row.grading_status, "pending");

    // Teacher room view / leaderboard / export.
    await finalizeIfExpired({ id: "cbtroom_teacher_view", status: "in_test" }, { regrade: true });
    assert.equal(leased(), 1);
    assert.equal(db.row.grading_status, "done");
    assert.equal(db.row.score, 4);
  } finally {
    console.error = errors;
  }
});

test("P14: a teacher read of a FINISHED room still runs the bounded regrade; a student read does not", async () => {
  const db = installFakeDb();
  db.gradingFailuresLeft = 1;
  db.row.aged = true;
  const errors = console.error;
  console.error = () => undefined;
  try {
    await submitAttempt(fakeParticipant(), fakeRoom(), { reason: "timer" });
    db.advance(db.dueInSeconds());
    const leased = () => db.statements.filter((sql) => sql.includes("FOR UPDATE SKIP LOCKED")).length;

    assert.equal(await finalizeIfExpired({ id: ROOM_ID, status: "finished" }), false);
    assert.equal(await finalizeIfExpired({ id: ROOM_ID, status: "lobby" }, { regrade: true }), false);
    assert.equal(leased(), 0, "no regrade on a student read or a lobby room");
    assert.equal(db.row.grading_status, "pending");

    assert.equal(await finalizeIfExpired({ id: ROOM_ID, status: "finished" }, { regrade: true }), false);
    assert.equal(leased(), 1);
    assert.equal(db.row.grading_status, "done");
    assert.equal(db.row.score, 4);
  } finally {
    console.error = errors;
  }
});

test("F10: a student poll's debounce never suppresses the teacher-read regrade", async () => {
  const db = installFakeDb();
  db.gradingFailuresLeft = 1;
  db.row.aged = true;
  const errors = console.error;
  console.error = () => undefined;
  try {
    await submitAttempt(fakeParticipant(), fakeRoom(), { reason: "timer" });
    db.advance(db.dueInSeconds());
    const leased = () => db.statements.filter((sql) => sql.includes("FOR UPDATE SKIP LOCKED")).length;

    // A student poll on the SAME room refreshes the per-room debounce...
    await finalizeIfExpired({ id: "cbtroom_shared_debounce", status: "in_test" });
    assert.equal(leased(), 0);
    // ...and the teacher's read a moment later (inside the 15 s window) still regrades.
    await finalizeIfExpired({ id: "cbtroom_shared_debounce", status: "in_test" }, { regrade: true });
    assert.equal(leased(), 1, "the regrade ran despite the student-refreshed debounce");
    assert.equal(db.row.grading_status, "done");
  } finally {
    console.error = errors;
  }
});

test("L7: a teacher retry ignores the backoff and grades now", async () => {
  const db = installFakeDb();
  db.gradingFailuresLeft = 1;
  const errors = console.error;
  console.error = () => undefined;
  try {
    await submitAttempt(fakeParticipant(), fakeRoom(), { reason: "timer" });
    db.row.grading_attempts = 3;
    db.row.grading_next_attempt_at = db.now + 1800 * 1000;
    db.row.stuck = true;
    const retried = await retryParticipantGrading(ROOM_ID, PARTICIPANT_ID);
    assert.equal(retried.gradingStatus, "done");
    assert.equal(db.row.score, 4);
    const reset = db.statements.find((sql) => sql.includes("SET grading_status = 'pending', grading_attempts = 0"));
    assert.match(reset ?? "", /grading_next_attempt_at = NOW\(\) \+/);
  } finally {
    console.error = errors;
  }
});

test("M7: the teacher retry predicate covers 'failed' and 'pending' older than a minute", () => {
  assert.equal(STUCK_PENDING_GRADING_SECONDS, 60);
  assert.match(TEACHER_RETRYABLE_GRADING_SQL, /grading_status = 'failed'/);
  assert.match(
    TEACHER_RETRYABLE_GRADING_SQL,
    /grading_status = 'pending' AND finished_at < NOW\(\) - INTERVAL '60 seconds'/,
  );
});

test("M7: a teacher retry grades an attempt stuck in 'pending' for over a minute", async () => {
  const db = installFakeDb();
  db.gradingFailuresLeft = 1;
  const errors = console.error;
  console.error = () => undefined;
  try {
    await submitAttempt(fakeParticipant(), fakeRoom(), { reason: "timer" });
    assert.equal(db.row.grading_status, "pending");
    assert.equal(db.row.grading_attempts, 1);
    // No sweep ran (cron down, room no longer in_test): the row just sits there.

    // Under a minute old: a first pass may still be running, so it is left alone.
    const early = await retryParticipantGrading(ROOM_ID, PARTICIPANT_ID);
    assert.deepEqual(early, { found: true, gradingStatus: "pending" });
    assert.equal(db.row.score, null);

    // Over a minute: the retry resets the budget and grades it now.
    db.row.stuck = true;
    const retried = await retryParticipantGrading(ROOM_ID, PARTICIPANT_ID);
    assert.equal(retried.found, true);
    assert.equal(retried.gradingStatus, "done");
    assert.equal(retried.score, 4);
    assert.equal(db.row.grading_status, "done");
    assert.equal(db.row.score, 4);
    const reset = db.statements.find((sql) => sql.includes("SET grading_status = 'pending', grading_attempts = 0"));
    assert.ok(reset?.includes(TEACHER_RETRYABLE_GRADING_SQL), "the UPDATE uses the shared predicate");
  } finally {
    console.error = errors;
  }
});

test("M7: a retry of a stuck 'pending' attempt that fails again stays 'pending' with a fresh budget", async () => {
  const db = installFakeDb();
  db.gradingFailuresLeft = 2;
  const errors = console.error;
  console.error = () => undefined;
  try {
    await submitAttempt(fakeParticipant(), fakeRoom(), { reason: "timer" });
    db.row.grading_attempts = GRADING_MAX_ATTEMPTS - 1;
    db.row.stuck = true;
    const retried = await retryParticipantGrading(ROOM_ID, PARTICIPANT_ID);
    assert.deepEqual(retried, { found: true, gradingStatus: "pending" });
    assert.equal(db.row.grading_attempts, 1, "budget was reset before the attempt");
    assert.equal(db.row.score, null);
  } finally {
    console.error = errors;
  }
});

test("M7: a done attempt is never re-graded by a retry", async () => {
  const db = installFakeDb();
  await submitAttempt(fakeParticipant(), fakeRoom(), { reason: "manual" });
  assert.equal(db.row.grading_status, "done");
  db.row.stuck = true;
  const before = db.statements.length;
  const retried = await retryParticipantGrading(ROOM_ID, PARTICIPANT_ID);
  assert.deepEqual(retried, { found: true, gradingStatus: "done" });
  assert.ok(!db.statements.slice(before).some((sql) => sql.includes("FROM cbt.test_questions tq")), "not graded again");
});

test("C6: an absent finalize is recorded 'done' and never queued for grading", async () => {
  const db = installFakeDb();
  const result = await submitAttempt(fakeParticipant(), fakeRoom(), { reason: "absent" });
  assert.equal(result.gradingStatus, "done");
  assert.equal(db.row.grading_status, "done");
  assert.equal(db.row.score, null);
  assert.ok(!db.statements.some((sql) => sql.includes("FROM cbt.test_questions tq")), "absent is not graded");
});

test("C4: an autosave after started_at + duration + grace is rejected 409 test_ended", async () => {
  const db = installFakeDb();
  db.windowOpen = false;
  await assert.rejects(
    saveAnswers(fakeParticipant(), fakeRoom(), { 1: { selectedOption: 0 } }, {}, 5),
    (error: Error & { status?: number; code?: string }) => {
      assert.equal(error.status, 409);
      assert.equal(error.code, "test_ended");
      return true;
    },
  );
  assert.ok(!db.statements.some((sql) => sql.includes("INSERT INTO cbt.answer_drafts")), "late draft not written");
});

test("C4: a late manual submit is accepted, graded, and recorded as a timer finalize", async () => {
  const db = installFakeDb();
  db.windowOpen = false;
  const result = await submitAttempt(fakeParticipant(), fakeRoom(), { reason: "manual" });
  assert.equal(result.alreadySubmitted, false);
  assert.equal(result.reason, "timer");
  assert.equal(result.score, 4);
  assert.equal(db.row.finalize_reason, "timer");
  assert.equal(db.row.auto_submitted, true);
  assert.equal(db.row.grading_status, "done");
});

test("C4: an in-window manual submit stays manual", async () => {
  const db = installFakeDb();
  const result = await submitAttempt(fakeParticipant(), fakeRoom(), { reason: "manual" });
  assert.equal(result.reason, "manual");
  assert.equal(db.row.auto_submitted, false);
});

test("C4: cbtDeadlineExpired boundaries (room clock + 10 s grace)", () => {
  const start = Date.parse("2026-10-22T10:00:00.000Z");
  const duration = 3600;
  const end = start + duration * 1000;
  const startedAt = new Date(start).toISOString();
  assert.equal(cbtDeadlineExpired(startedAt, duration, end - 1_000), false, "end - 1 s");
  assert.equal(cbtDeadlineExpired(startedAt, duration, end), false, "end");
  assert.equal(cbtDeadlineExpired(startedAt, duration, end + 10_000), false, "end + 10 s (grace)");
  assert.equal(cbtDeadlineExpired(startedAt, duration, end + 11_000), true, "end + 11 s");
  assert.equal(cbtDeadlineExpired(null, duration, end + 11_000), false, "never started");
  assert.equal(cbtDeadlineExpired(startedAt, null, end + 11_000), false, "untimed room");
});
