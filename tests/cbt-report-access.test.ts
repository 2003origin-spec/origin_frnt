/**
 * CBT report cards — security regression suite.
 *
 * The report is the ONLY surface that hands a student the answer key, so the
 * things pinned here are the things that must never regress:
 *   1. a report token cannot be replayed as an ATTEMPT token, and vice versa —
 *      they share a signing secret, so only the `purpose` claim separates them;
 *   2. the usual token failure modes (tamper, wrong secret, expiry, missing
 *      fields) all reject rather than degrade open;
 *   3. the public route stays public at the edge and the admin/teacher control
 *      routes stay gated (route-policy contract);
 *   4. the attempt payload STILL leaks nothing now that an answer-key reader
 *      exists in the same module tree.
 */

// Both token modules read this at call time; set it before any sign/verify.
process.env.CBT_PARTICIPANT_TOKEN_SECRET = "test-cbt-participant-secret-least-32-chars";

import test from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";

import { signParticipantToken, verifyParticipantToken } from "@/lib/cbt/participant-token";
import { signReportToken, verifyReportToken } from "@/lib/cbt/report-token";
import { sanitizeQuestionForStudent, type TestQuestionRow } from "@/server/cbt/cbt-attempts-service";
import { getApiRoutePolicy, getAppRoutePolicy } from "@/server/route-policy";

const SECRET = new TextEncoder().encode(process.env.CBT_PARTICIPANT_TOKEN_SECRET);
const ROOM = "cbtroom_abc";
const PARTICIPANT = "cbtp_xyz";

// ── 1. The two token families must not be interchangeable ───────────────────

test("a report token round-trips its own claims", async () => {
  const token = await signReportToken({ room_id: ROOM, participant_id: PARTICIPANT });
  assert.deepEqual(await verifyReportToken(token), { room_id: ROOM, participant_id: PARTICIPANT });
});

test("an ATTEMPT token cannot be used as a report token", async () => {
  // Same secret, same shape — only the `purpose` claim stops this.
  const attempt = await signParticipantToken({ room_id: ROOM, participant_id: PARTICIPANT, tv: 1 });
  assert.equal(await verifyReportToken(attempt), null);
});

test("a REPORT token cannot be used as an attempt token", async () => {
  const report = await signReportToken({ room_id: ROOM, participant_id: PARTICIPANT });
  // It must not authorise autosave/submit: those need a token_version, which a
  // report token never carries.
  assert.equal(await verifyParticipantToken(report), null);
});

// ── 2. Report-token failure modes ───────────────────────────────────────────

test("a tampered report token rejects", async () => {
  const token = await signReportToken({ room_id: ROOM, participant_id: PARTICIPANT });
  const [header, payload, signature] = token.split(".");
  const forged = Buffer.from(
    JSON.stringify({ room_id: ROOM, participant_id: "someone_else", purpose: "report", v: 1 }),
  ).toString("base64url");
  assert.equal(await verifyReportToken(`${header}.${forged}.${signature}`), null);
  assert.notEqual(payload, forged);
});

test("a report token signed with another secret rejects", async () => {
  const foreign = await new SignJWT({ room_id: ROOM, participant_id: PARTICIPANT, purpose: "report", v: 1 })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(new TextEncoder().encode("a-different-secret-of-at-least-32-characters"));
  assert.equal(await verifyReportToken(foreign), null);
});

test("an expired report token rejects", async () => {
  const expired = await new SignJWT({ room_id: ROOM, participant_id: PARTICIPANT, purpose: "report", v: 1 })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
    .sign(SECRET);
  assert.equal(await verifyReportToken(expired), null);
});

test("a report token missing required claims rejects", async () => {
  for (const claims of [
    { participant_id: PARTICIPANT, purpose: "report", v: 1 }, // no room
    { room_id: ROOM, purpose: "report", v: 1 }, // no participant
    { room_id: ROOM, participant_id: PARTICIPANT, v: 1 }, // no purpose
    { room_id: ROOM, participant_id: PARTICIPANT, purpose: "report", v: 2 }, // wrong version
  ]) {
    const token = await new SignJWT(claims)
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(SECRET);
    assert.equal(await verifyReportToken(token), null, `accepted ${JSON.stringify(claims)}`);
  }
});

test("a missing or garbage report cookie rejects instead of throwing", async () => {
  assert.equal(await verifyReportToken(undefined), null);
  assert.equal(await verifyReportToken(""), null);
  assert.equal(await verifyReportToken("not.a.jwt"), null);
});

// ── 3. Route policy contract ────────────────────────────────────────────────

test("the report surfaces sit on the right side of the auth boundary", () => {
  // Public: the student has no Origin account at all.
  assert.equal(getApiRoutePolicy("/api/cbt-student/report").kind, "public");
  assert.equal(getAppRoutePolicy("/cbt/r/[slug]/report").kind, "public");

  // Gated: the switches that publish a report are never public.
  assert.deepEqual(getApiRoutePolicy("/api/admin/cbt/teachers"), { kind: "authenticated" });
  assert.deepEqual(getApiRoutePolicy("/api/cbt/rooms/[roomId]"), {
    kind: "role",
    roles: ["cbt_teacher"],
  });
});

// ── 4. The attempt payload still leaks nothing ──────────────────────────────

test("adding an answer-key reader did not open up the in-test payload", () => {
  const question: TestQuestionRow = {
    position: 0,
    questionId: "q1",
    questionType: "mcq",
    stem: "What is 2 + 2?",
    image: null,
    options: [{ text: "3" }, { text: "4" }],
    answer: { correctOption: 1, answerText: "4", tolerance: 0.1 },
    explanation: "Because it is.",
    subject: "Maths",
    chapter: "Arithmetic",
    marks: 4,
    negativeMarks: -1,
  };
  const sanitized = sanitizeQuestionForStudent(question);
  const serialized = JSON.stringify(sanitized);

  assert.equal("answer" in sanitized, false);
  assert.equal("explanation" in sanitized, false);
  assert.equal(serialized.includes("Because it is."), false);
  assert.equal(serialized.includes("correctOption"), false);
});
