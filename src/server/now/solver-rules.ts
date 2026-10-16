/**
 * Solver registration rules — pure (plan doc, "Solver network and
 * registration" and "Teacher verification"). The service layer persists;
 * these decide what is valid, what is still missing, and whether a quiz passed.
 */

import { createHash, randomBytes } from "node:crypto";

import type { HelperRole } from "./types";

export const NOW_SUBJECTS = ["physics", "chemistry", "mathematics", "biology"] as const;
export type NowSubject = (typeof NOW_SUBJECTS)[number];

export function isNowSubject(value: unknown): value is NowSubject {
  return typeof value === "string" && (NOW_SUBJECTS as readonly string[]).includes(value);
}

/** Document slots an applicant can upload. */
export const DOCUMENT_KINDS = ["aadhaar_masked", "pan", "marksheet", "degree", "teaching_certificate", "selfie"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const ALLOWED_DOCUMENT_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

export type ApplicationDraft = {
  role: HelperRole | null;
  displayName: string;
  subjects: string[];
  /** subject → chapters; an empty list means the whole subject. */
  chapters: Record<string, string[]>;
  languages: string[];
  documents: Partial<Record<DocumentKind, string>>;
  panProvided: boolean;
  isMinor: boolean;
  hasSolverConsent: boolean;
  /** subject → best score as a percent. */
  quizPercent: Record<string, number>;
  agreementAcceptedVersion: string | null;
};

export type SubmitCheck = { ready: boolean; missing: string[] };

/**
 * Everything an application needs before it can be submitted for review.
 * Minors give no PAN but need a guardian consent row for purpose 'solver'.
 */
export function checkReadyToSubmit(
  draft: ApplicationDraft,
  options: { passPercent: number; agreementVersion: string },
): SubmitCheck {
  const missing: string[] = [];
  if (!draft.role) missing.push("Choose a role.");
  if (draft.displayName.trim().length < 2) missing.push("Enter the name students will see.");
  const subjects = draft.subjects.filter(isNowSubject);
  if (subjects.length === 0) missing.push("Pick at least one subject.");
  if (draft.languages.length === 0) missing.push("Pick at least one language.");
  if (!draft.documents.aadhaar_masked) missing.push("Upload a masked Aadhaar (first 8 digits hidden).");
  if (!draft.documents.selfie) missing.push("Upload a selfie to match your ID.");
  if (!draft.documents.marksheet && !draft.documents.degree && !draft.documents.teaching_certificate) {
    missing.push("Upload a marksheet, degree or teaching certificate.");
  }
  if (draft.isMinor) {
    if (!draft.hasSolverConsent) missing.push("A parent or guardian must give consent.");
  } else if (!draft.panProvided) {
    missing.push("Enter your PAN.");
  }
  for (const subject of subjects) {
    const score = draft.quizPercent[subject];
    if (score === undefined) missing.push(`Take the ${subject} quiz.`);
    else if (score < options.passPercent) missing.push(`Pass the ${subject} quiz (${options.passPercent}% needed).`);
  }
  if (draft.agreementAcceptedVersion !== options.agreementVersion) missing.push("Accept the Helper Agreement.");
  return { ready: missing.length === 0, missing };
}

/** Indian PAN: 5 letters, 4 digits, 1 letter. */
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export function normalizePan(raw: string): string | null {
  const cleaned = raw.replace(/\s+/g, "").toUpperCase();
  return PAN_PATTERN.test(cleaned) ? cleaned : null;
}

/** Shown in admin: only the last 4 characters. */
export function maskPan(pan: string): string {
  return `XXXXXX${pan.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Quiz.

export type QuizQuestion = { id: string; correctOption: number };

/** Score a single-answer MCQ quiz. Unanswered and out-of-range answers count as wrong. */
export function gradeQuiz(
  questions: readonly QuizQuestion[],
  answers: Readonly<Record<string, number | null | undefined>>,
): { score: number; total: number; percent: number } {
  const total = questions.length;
  const score = questions.filter((q) => answers[q.id] === q.correctOption).length;
  return { score, total, percent: total === 0 ? 0 : Math.round((score / total) * 100) };
}

/** A submission after the deadline (plus 30 s of network grace) is refused. */
export function isQuizExpired(expiresAt: Date, now: Date): boolean {
  return now.getTime() > expiresAt.getTime() + 30_000;
}

/** At most one attempt per subject per 24 hours, so the quiz cannot be brute-forced. */
export function nextQuizAllowedAt(lastStartedAt: Date | null): Date | null {
  return lastStartedAt ? new Date(lastStartedAt.getTime() + 24 * 60 * 60_000) : null;
}

// ---------------------------------------------------------------------------
// Guardian consent tokens. Only the hash is stored; the raw token travels in
// the guardian's email link once.

export function newConsentToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashConsentToken(token) };
}

export function hashConsentToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export const CONSENT_LINK_TTL_MS = 72 * 60 * 60_000;
export const GUARDIAN_RELATIONSHIPS = ["mother", "father", "legal_guardian", "other_guardian"] as const;
export type GuardianRelationship = (typeof GUARDIAN_RELATIONSHIPS)[number];

/** Date of birth must be a real past date that makes the user 8 to 100. */
export function validateDateOfBirth(raw: string, now: Date): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) return null;
  const years = (now.getTime() - date.getTime()) / (365.25 * 24 * 60 * 60_000);
  return years >= 8 && years <= 100 ? date : null;
}
