/**
 * Guardian consent and solver registration against a real Postgres:
 * the consent link works once and expires, a minor's application cannot be
 * submitted without guardian consent, the quiz is graded server-side from the
 * real question bank, approval writes the helper row + expertise in one go,
 * and the Origin bot row is idempotent.
 *
 * Skipped when USER_DATABASE_URL isn't configured (plain CI). Email is the
 * dev mock (no SMTP in tests), so the consent link is read from its log line.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import { confirmConsent, getConsentStatus, previewConsent, startGuardianConsent } from "@/server/now/consent-service";
import { ensureNowSchema } from "@/server/now/now-schema";
import { setSetting } from "@/server/platform-settings";
import {
  BOT_HELPER_ID,
  acceptAgreement,
  approveApplication,
  confirmDocumentUpload,
  ensureBotHelper,
  getMyApplication,
  saveApplication,
  startQuiz,
  submitApplication,
  submitQuiz,
} from "@/server/now/solver-service";
import { getOgcodeCatalogCounts } from "@/server/ogcode-catalog";

import { closePool, dbConfigured, makeId, rawPool } from "./_db";

const SKIP = !dbConfigured();

async function seedUser(dob: string | null): Promise<string> {
  const id = makeId("now_solver");
  await rawPool().query(
    `INSERT INTO origin_users (id, name, email, role, password_hash, date_of_birth) VALUES ($1, 'Aarav', $2, 'student', 'x', $3)`,
    [id, `${id}@example.com`, dob],
  );
  return id;
}

/** Captures the consent link the dev email mock logs. */
async function captureConsentLink(run: () => Promise<unknown>): Promise<string> {
  const original = console.warn;
  let token = "";
  console.warn = (...args: unknown[]) => {
    const text = JSON.stringify(args);
    const match = text.match(/token=([A-Za-z0-9_-]{20,})/);
    if (match) token = match[1];
  };
  try {
    await run();
  } finally {
    console.warn = original;
  }
  assert.ok(token, "the consent email carried a link");
  return token;
}

async function seedQuizQuestions(subject: string, count: number): Promise<Map<string, number>> {
  await getOgcodeCatalogCounts(); // creates ogcode_questions on a fresh database
  const answers = new Map<string, number>();
  const base = 900_000 + Math.floor(Math.random() * 50_000);
  for (let i = 0; i < count; i++) {
    const id = makeId("q");
    const correct = i % 4;
    answers.set(id, correct);
    await rawPool().query(
      `INSERT INTO ogcode_questions (id, source_index, text, options, correct_option, explanation, subject, chapter, concept, difficulty, question_type)
       VALUES ($1, $2, $3, $4::jsonb, $5, 'because', $6, 'Kinematics', 'Velocity', 'Easy', 'mcq')`,
      [id, base + i, `Question ${i}`, JSON.stringify(["A", "B", "C", "D"]), correct, subject],
    );
  }
  return answers;
}

test("a guardian consent link works once, and the minor is then consented", { skip: SKIP }, async () => {
  await ensureNowSchema();
  const minor = await seedUser(null);
  const token = await captureConsentLink(() =>
    startGuardianConsent({
      userId: minor,
      purpose: "student",
      dateOfBirth: "2011-05-01",
      guardianName: "Sunita Sharma",
      guardianEmail: "sunita@example.com",
      guardianPhone: null,
      relationship: "mother",
    }),
  );
  const before = await getConsentStatus(minor);
  assert.equal(before.isMinor, true);
  assert.equal(before.student.consented, false);
  assert.match(before.student.pendingSentTo ?? "", /^s\*\*\*@example\.com$/);

  const preview = await previewConsent(token);
  assert.equal(preview.childName, "Aarav");
  assert.equal(preview.alreadyConfirmed, false);

  await assert.rejects(confirmConsent({ token, acceptedPolicy: false }), /tick the box/);
  await confirmConsent({ token, acceptedPolicy: true });
  await confirmConsent({ token, acceptedPolicy: true }); // replay is a no-op, not a second row
  const rows = await rawPool().query(`SELECT count(*)::int AS n FROM app.guardian_consents WHERE user_id = $1`, [minor]);
  assert.equal(rows.rows[0].n, 1);
  assert.equal((await getConsentStatus(minor)).student.consented, true);
});

test("an expired link is refused and an adult needs no consent", { skip: SKIP }, async () => {
  const minor = await seedUser("2012-01-01");
  const token = await captureConsentLink(() =>
    startGuardianConsent({
      userId: minor,
      purpose: "student",
      dateOfBirth: null,
      guardianName: "Raj Kumar",
      guardianEmail: "raj@example.com",
      guardianPhone: null,
      relationship: "father",
    }),
  );
  await assert.rejects(
    confirmConsent({ token, acceptedPolicy: true, now: new Date(Date.now() + 73 * 60 * 60_000) }),
    /expired/,
  );
  const adult = await seedUser("1995-01-01");
  const result = await startGuardianConsent({
    userId: adult,
    purpose: "solver",
    dateOfBirth: null,
    guardianName: "",
    guardianEmail: "",
    guardianPhone: null,
    relationship: "",
  });
  assert.deepEqual(result, { needsConsent: false, sentTo: null });
});

test("a minor solver application: consent gate, real quiz, approval creates the helper", { skip: SKIP }, async () => {
  process.env.NOW_KYC_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  await setSetting("now_quiz", JSON.stringify({ questions: 5, minutes: 15, passPercent: 60 }), null);
  await setSetting("now_agreement_version", "test-v1", null);
  const answers = await seedQuizQuestions("physics", 8);
  const student = await seedUser("2010-03-01");

  await saveApplication(student, {
    role: "school_student",
    displayName: "Aarav S",
    subjects: ["physics"],
    chapters: { physics: ["Kinematics"] },
    languages: ["Hindi", "English"],
  });
  for (const kind of ["aadhaar_masked", "selfie", "marksheet"]) {
    await confirmDocumentUpload(student, { kind, objectKey: `origin-now/kyc/${student}/${kind}-file.jpg` });
  }
  await assert.rejects(
    confirmDocumentUpload(student, { kind: "selfie", objectKey: `origin-now/kyc/someone-else/selfie-x.jpg` }),
    /does not belong/,
  );
  await acceptAgreement(student, "test-v1");

  const quiz = await startQuiz(student, "physics");
  assert.equal(quiz.questions.length, 5);
  assert.ok(quiz.questions.every((q) => !("correctOption" in q)), "answers never reach the applicant");
  const allRight = Object.fromEntries(quiz.questions.map((q) => [q.id, answers.get(q.id) ?? 0]));
  const graded = await submitQuiz(student, quiz.attemptId, allRight);
  assert.equal(graded.percent, 100);
  await assert.rejects(startQuiz(student, "physics"), /retake/, "one attempt per 24 hours");

  const view = await getMyApplication(student);
  assert.equal(view?.isMinor, true);
  assert.deepEqual(view?.readiness.missing, ["A parent or guardian must give consent."]);
  await assert.rejects(submitApplication(student), /guardian/);

  const token = await captureConsentLink(() =>
    startGuardianConsent({
      userId: student,
      purpose: "solver",
      dateOfBirth: null,
      guardianName: "Meena S",
      guardianEmail: "meena@example.com",
      guardianPhone: null,
      relationship: "mother",
    }),
  );
  await confirmConsent({ token, acceptedPolicy: true });
  const submitted = await submitApplication(student);
  assert.equal(submitted.status, "submitted");

  await assert.rejects(approveApplication({ applicationId: submitted.id, adminId: student, demoPassed: false }), /demo/);
  const { helperId } = await approveApplication({ applicationId: submitted.id, adminId: student, demoPassed: true });
  const helper = await rawPool().query(`SELECT kind, is_minor, agreement_version, languages FROM now.helpers WHERE id = $1`, [helperId]);
  assert.deepEqual(helper.rows[0], { kind: "human", is_minor: true, agreement_version: "test-v1", languages: ["hindi", "english"] });
  const expertise = await rawPool().query(`SELECT subject, chapter FROM now.helper_expertise WHERE helper_id = $1`, [helperId]);
  assert.deepEqual(expertise.rows, [{ subject: "physics", chapter: "Kinematics" }]);
  await assert.rejects(approveApplication({ applicationId: submitted.id, adminId: student, demoPassed: true }), /not submitted/);
});

test("the Origin bot helper row is created once", { skip: SKIP }, async () => {
  assert.equal(await ensureBotHelper(), BOT_HELPER_ID);
  assert.equal(await ensureBotHelper(), BOT_HELPER_ID);
  const bots = await rawPool().query(`SELECT count(*)::int AS n FROM now.helpers WHERE kind = 'bot'`);
  assert.equal(bots.rows[0].n, 1);
  const subjects = await rawPool().query(`SELECT count(*)::int AS n FROM now.helper_expertise WHERE helper_id = $1`, [BOT_HELPER_ID]);
  assert.equal(subjects.rows[0].n, 4);
  await closePool();
});
