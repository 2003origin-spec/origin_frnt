/**
 * Solver registration and guardian consent rules: what an application needs
 * before submit (adults vs minors), PAN handling, quiz grading, consent tokens,
 * KYC encryption, and the public edge policy for the guardian's link.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import { renderConsentEmail } from "@/server/now/consent-service";
import { decryptKyc, encryptKyc, isKycEncryptionConfigured, KycEncryptionUnavailableError } from "@/server/now/kyc-crypto";
import {
  checkReadyToSubmit,
  gradeQuiz,
  hashConsentToken,
  isQuizExpired,
  maskPan,
  newConsentToken,
  nextQuizAllowedAt,
  normalizePan,
  validateDateOfBirth,
  type ApplicationDraft,
} from "@/server/now/solver-rules";
import { getApiRoutePolicy, getAppRoutePolicy } from "@/server/route-policy";

const options = { passPercent: 70, agreementVersion: "v1" };

function draft(overrides: Partial<ApplicationDraft> = {}): ApplicationDraft {
  return {
    role: "teacher",
    displayName: "Ravi",
    subjects: ["physics"],
    chapters: {},
    languages: ["hindi"],
    documents: { aadhaar_masked: "k1", selfie: "k2", degree: "k3" },
    panProvided: true,
    isMinor: false,
    hasSolverConsent: false,
    quizPercent: { physics: 80 },
    agreementAcceptedVersion: "v1",
    ...overrides,
  };
}

test("a complete adult application is ready", () => {
  assert.deepEqual(checkReadyToSubmit(draft(), options), { ready: true, missing: [] });
});

test("PAN is optional (B77); minors need guardian consent", () => {
  assert.deepEqual(checkReadyToSubmit(draft({ panProvided: false }), options), { ready: true, missing: [] });
  const minor = draft({ isMinor: true, panProvided: false, role: "school_student" });
  assert.ok(checkReadyToSubmit(minor, options).missing.some((m) => m.includes("guardian")));
  assert.equal(checkReadyToSubmit({ ...minor, hasSolverConsent: true }, options).ready, true);
});

test("every chosen subject needs a passed quiz", () => {
  const twoSubjects = draft({ subjects: ["physics", "chemistry"] });
  assert.ok(checkReadyToSubmit(twoSubjects, options).missing.some((m) => m.includes("chemistry quiz")));
  const failed = draft({ quizPercent: { physics: 60 } });
  assert.ok(checkReadyToSubmit(failed, options).missing.some((m) => m.includes("70%")));
});

test("ID, selfie, a proof of level and the current agreement are all required", () => {
  const missing = checkReadyToSubmit(draft({ documents: {}, agreementAcceptedVersion: "v0" }), options).missing;
  assert.ok(missing.some((m) => m.includes("Aadhaar")));
  assert.ok(missing.some((m) => m.includes("selfie")));
  assert.ok(missing.some((m) => m.includes("marksheet")));
  assert.ok(missing.some((m) => m.includes("Agreement")));
});

test("PAN is normalised, validated and masked", () => {
  assert.equal(normalizePan(" abcde 1234f "), "ABCDE1234F");
  assert.equal(normalizePan("ABCD1234F"), null);
  assert.equal(maskPan("ABCDE1234F"), "XXXXXX234F");
});

test("quiz grading counts only exact correct options", () => {
  const questions = [
    { id: "a", correctOption: 1 },
    { id: "b", correctOption: 0 },
    { id: "c", correctOption: 3 },
  ];
  assert.deepEqual(gradeQuiz(questions, { a: 1, b: 2, c: null }), { score: 1, total: 3, percent: 33 });
  assert.deepEqual(gradeQuiz([], {}), { score: 0, total: 0, percent: 0 });
});

test("a quiz has a deadline with 30 s grace and one attempt per 24 hours", () => {
  const deadline = new Date("2026-10-16T12:00:00Z");
  assert.equal(isQuizExpired(deadline, new Date("2026-10-16T12:00:20Z")), false);
  assert.equal(isQuizExpired(deadline, new Date("2026-10-16T12:00:31Z")), true);
  assert.equal(nextQuizAllowedAt(null), null);
  assert.equal(nextQuizAllowedAt(deadline)?.toISOString(), "2026-10-17T12:00:00.000Z");
});

test("consent tokens are random and only their hash is comparable", () => {
  const a = newConsentToken();
  const b = newConsentToken();
  assert.notEqual(a.token, b.token);
  assert.equal(hashConsentToken(a.token), a.hash);
  assert.notEqual(a.hash, a.token);
});

test("date of birth must be a real date for someone aged 8 to 100", () => {
  const now = new Date("2026-10-16T00:00:00Z");
  assert.equal(validateDateOfBirth("2010-02-30", now), null);
  assert.equal(validateDateOfBirth("2024-01-01", now), null);
  assert.equal(validateDateOfBirth("16/10/2010", now), null);
  assert.equal(validateDateOfBirth("2010-10-16", now)?.toISOString().slice(0, 10), "2010-10-16");
});

test("PAN encryption round-trips and refuses to run without a key", () => {
  const saved = process.env.NOW_KYC_ENCRYPTION_KEY;
  try {
    delete process.env.NOW_KYC_ENCRYPTION_KEY;
    assert.equal(isKycEncryptionConfigured(), false);
    assert.throws(() => encryptKyc("ABCDE1234F"), KycEncryptionUnavailableError);
    process.env.NOW_KYC_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    const sealed = encryptKyc("ABCDE1234F");
    assert.doesNotMatch(sealed, /ABCDE1234F/);
    assert.equal(decryptKyc(sealed), "ABCDE1234F");
    assert.notEqual(encryptKyc("ABCDE1234F"), sealed, "a fresh IV every time");
  } finally {
    if (saved === undefined) delete process.env.NOW_KYC_ENCRYPTION_KEY;
    else process.env.NOW_KYC_ENCRYPTION_KEY = saved;
  }
});

test("the consent email names the child and carries the link", () => {
  const email = renderConsentEmail({
    guardianName: "Sunita",
    childName: "Aarav",
    purpose: "student",
    link: "https://www.o3origin.com/now/consent?token=abc",
  });
  assert.match(email.subject, /Aarav/);
  assert.match(email.text, /now\/consent\?token=abc/);
  assert.match(email.html, /now\/consent\?token=abc/);
  assert.match(email.text, /recorded for safety/);
});

test("only the two consent endpoints and the consent page are public", () => {
  assert.equal(getApiRoutePolicy("/api/now/consent/preview").kind, "public");
  assert.equal(getApiRoutePolicy("/api/now/consent/confirm").kind, "public");
  assert.equal(getApiRoutePolicy("/api/now/consent/start").kind, "authenticated");
  assert.equal(getApiRoutePolicy("/api/now/solver/application").kind, "authenticated");
  assert.equal(getAppRoutePolicy("/now/consent").kind, "public");
  assert.equal(getAppRoutePolicy("/now/wallet").kind, "authenticated");
});
