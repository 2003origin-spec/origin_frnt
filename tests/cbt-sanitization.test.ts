/**
 * Phase 11 (CBT) — security regression suite.
 *   1. Every question type's student payload is deep-scanned for answer keys.
 *   2. Participant-token integrity: tamper / wrong-secret / expired / missing
 *      fields all reject. (Room + token_version scoping is enforced in
 *      resolveParticipantFromToken against the DB — covered at integration.)
 */

// The token module reads this at call time; set it before any sign/verify.
process.env.CBT_PARTICIPANT_TOKEN_SECRET = "test-cbt-participant-secret-least-32-chars";

import test from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";

import { sanitizeQuestionForStudent, type TestQuestionRow } from "@/server/cbt/cbt-attempts-service";
import { signParticipantToken, verifyParticipantToken } from "@/lib/cbt/participant-token";
import type { CbtQuestionAnswer, CbtQuestionType } from "@/lib/cbt/question-model";

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
  "units",
];

function deepScan(value: unknown, path = "$"): string[] {
  const hits: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((v, i) => hits.push(...deepScan(v, `${path}[${i}]`)));
  } else if (value && typeof value === "object") {
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.includes(key)) hits.push(`${path}.${key}`);
      hits.push(...deepScan(v, `${path}.${key}`));
    }
  }
  return hits;
}

const ANSWERS: Record<CbtQuestionType, CbtQuestionAnswer> = {
  mcq: { correctOption: 2 },
  msq: { correctOptions: [0, 2] },
  numerical: { answerText: "9.8", tolerance: 0.1 },
  numerical_with_units: { answerText: "9.8", tolerance: 0.1, units: "m/s^2" },
  symbolic_expression: { answerText: "x^2 + 1" },
  equation: { answerText: "E = m c^2" },
  matrix_match: { matrixData: { rows: ["A", "B"], columns: ["P", "Q"], correct_pairs: [[0, 1]] } },
  subjective: { answerText: "a model essay answer" },
};

function makeQuestion(type: CbtQuestionType): TestQuestionRow {
  return {
    position: 1,
    questionId: `cbtq_${type}`,
    questionType: type,
    stem: "stem",
    image: null,
    options: [{ text: "a" }, { text: "b" }, { text: "c" }],
    answer: ANSWERS[type],
    explanation: "the secret explanation",
    subject: "Physics",
    chapter: "Kinematics",
    marks: 4,
    negativeMarks: -1,
  };
}

for (const type of Object.keys(ANSWERS) as CbtQuestionType[]) {
  test(`Phase 11: sanitized ${type} payload leaks no answer keys`, () => {
    const out = sanitizeQuestionForStudent(makeQuestion(type));
    const hits = deepScan(out);
    assert.deepEqual(hits, [], `${type} leaked: ${hits.join(", ")}`);
  });
}

test("Phase 11: participant token round-trips", async () => {
  const token = await signParticipantToken({ room_id: "r1", participant_id: "p1", tv: 3 });
  const claims = await verifyParticipantToken(token);
  assert.deepEqual(claims, { room_id: "r1", participant_id: "p1", tv: 3 });
});

test("Phase 11: tampered token is rejected", async () => {
  const token = await signParticipantToken({ room_id: "r1", participant_id: "p1", tv: 1 });
  const tampered = `${token.slice(0, -3)}xyz`;
  assert.equal(await verifyParticipantToken(tampered), null);
});

test("Phase 11: token signed with a different secret is rejected", async () => {
  const foreign = await new SignJWT({ room_id: "r1", participant_id: "p1", tv: 1, v: 1 })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(new TextEncoder().encode("a-totally-different-secret-32-characters!!"));
  assert.equal(await verifyParticipantToken(foreign), null);
});

test("Phase 11: expired token is rejected", async () => {
  const expired = await new SignJWT({ room_id: "r1", participant_id: "p1", tv: 1, v: 1 })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
    .sign(new TextEncoder().encode(process.env.CBT_PARTICIPANT_TOKEN_SECRET!));
  assert.equal(await verifyParticipantToken(expired), null);
});

test("Phase 11: token missing required claims is rejected", async () => {
  const partial = await new SignJWT({ room_id: "r1", v: 1 })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(new TextEncoder().encode(process.env.CBT_PARTICIPANT_TOKEN_SECRET!));
  assert.equal(await verifyParticipantToken(partial), null);
});
