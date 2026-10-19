/**
 * Solver registration (plan doc, "Solver network and registration"; build
 * order step 4). Anyone who passes KYC can apply — teachers, college students,
 * school students (with guardian consent) and part-timers.
 *
 *   draft → (documents, PAN, quiz per subject, Helper Agreement) → submitted
 *         → admin approves → now.helpers row + expertise   | admin rejects
 *
 * Documents go to the PRIVATE import bucket under origin-now/kyc/<userId>/ via
 * a presigned PUT; admins read them through short-lived presigned GETs. The
 * full Aadhaar number is never stored (masked copy only); PAN is encrypted.
 */

import { randomUUID } from "node:crypto";

import { formatISTDateTimeDMY } from "@/lib/format-time";
import { getOgcodeCatalogQuestionMap, sampleOgcodeCatalogQuestionIds } from "@/server/ogcode-catalog";
import { createPresignedR2PutUrl } from "@/server/media-storage";
import { createPrefixedId } from "@/server/workspaces/ids";
import { getUserPostgresPool } from "@/server/user-postgres";

import { encryptKyc, isKycEncryptionConfigured } from "./kyc-crypto";
import { isMinorOn } from "./now-access";
import { NowError } from "./now-http";
import { ensureNowSchema } from "./now-schema";
import { getNowSettings } from "./now-settings";
import { deletePrivateFile, getPrivateFilesBucket, requirePrivateFilesBucket } from "./private-files";
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  DOCUMENT_KINDS,
  MAX_DOCUMENT_BYTES,
  checkReadyToSubmit,
  gradeQuiz,
  isNowSubject,
  isQuizExpired,
  maskPan,
  nextQuizAllowedAt,
  normalizePan,
  type ApplicationDraft,
  type DocumentKind,
} from "./solver-rules";
import { HELPER_ROLES, type ApplicationStatus, type HelperRole } from "./types";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

const KYC_PREFIX = "origin-now/kyc";
export const BOT_HELPER_ID = "helper_origin_bot";

type ApplicationRow = {
  id: string;
  user_id: string;
  role: HelperRole;
  display_name: string;
  subjects: string[];
  chapters: Record<string, string[]>;
  languages: string[];
  documents: Partial<Record<DocumentKind, string>>;
  pan_encrypted: string | null;
  pan_last4: string | null;
  guardian_consent_id: string | null;
  quiz_scores: Record<string, number>;
  demo_passed: boolean | null;
  agreement_version: string | null;
  agreement_accepted_at: Date | null;
  status: ApplicationStatus;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  reject_reason: string | null;
  submitted_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type ApplicationView = {
  id: string;
  status: ApplicationStatus;
  role: HelperRole;
  displayName: string;
  subjects: string[];
  chapters: Record<string, string[]>;
  languages: string[];
  documents: DocumentKind[];
  panMasked: string | null;
  quizScores: Record<string, number>;
  agreementVersion: string | null;
  rejectReason: string | null;
  submittedAt: string | null;
  isMinor: boolean;
  hasSolverConsent: boolean;
  readiness: { ready: boolean; missing: string[] };
};

async function loadUserFacts(userId: string): Promise<{ isMinor: boolean; hasSolverConsent: boolean }> {
  const res = await pool().query<{ date_of_birth: Date | null; has_consent: boolean }>(
    `SELECT u.date_of_birth,
            EXISTS (SELECT 1 FROM app.guardian_consents g
                     WHERE g.user_id = u.id AND g.purpose = 'solver' AND g.withdrawn_at IS NULL) AS has_consent
       FROM origin_users u WHERE u.id = $1`,
    [userId],
  );
  return { isMinor: isMinorOn(res.rows[0]?.date_of_birth ?? null, new Date()), hasSolverConsent: Boolean(res.rows[0]?.has_consent) };
}

function toDraft(row: ApplicationRow, facts: { isMinor: boolean; hasSolverConsent: boolean }): ApplicationDraft {
  return {
    role: row.role,
    displayName: row.display_name,
    subjects: row.subjects,
    chapters: row.chapters,
    languages: row.languages,
    documents: row.documents,
    panProvided: Boolean(row.pan_encrypted),
    isMinor: facts.isMinor,
    hasSolverConsent: facts.hasSolverConsent,
    quizPercent: row.quiz_scores,
    agreementAcceptedVersion: row.agreement_version,
  };
}

async function toView(row: ApplicationRow): Promise<ApplicationView> {
  const facts = await loadUserFacts(row.user_id);
  const settings = await getNowSettings();
  return {
    id: row.id,
    status: row.status,
    role: row.role,
    displayName: row.display_name,
    subjects: row.subjects,
    chapters: row.chapters,
    languages: row.languages,
    documents: Object.keys(row.documents) as DocumentKind[],
    panMasked: row.pan_last4 ? maskPan(`XXXXXX${row.pan_last4}`) : null,
    quizScores: row.quiz_scores,
    agreementVersion: row.agreement_version,
    rejectReason: row.reject_reason,
    submittedAt: row.submitted_at ? row.submitted_at.toISOString() : null,
    ...facts,
    readiness: checkReadyToSubmit(toDraft(row, facts), {
      passPercent: settings.quiz.passPercent,
      agreementVersion: settings.agreementVersion,
    }),
  };
}

async function latestApplication(userId: string): Promise<ApplicationRow | null> {
  await ensureNowSchema();
  const res = await pool().query<ApplicationRow>(
    `SELECT * FROM now.helper_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId],
  );
  return res.rows[0] ?? null;
}

async function openDraft(userId: string): Promise<ApplicationRow> {
  const row = await latestApplication(userId);
  if (!row || row.status === "rejected") throw new NowError(404, "no_application", "Start an application first.");
  if (row.status === "submitted") throw new NowError(409, "under_review", "Your application is under review and cannot be changed.");
  if (row.status === "approved") throw new NowError(409, "already_approved", "You are already an approved solver.");
  return row;
}

export async function getMyApplication(userId: string): Promise<ApplicationView | null> {
  const row = await latestApplication(userId);
  return row ? toView(row) : null;
}

export type ApplicationPatch = {
  role?: string;
  displayName?: string;
  subjects?: string[];
  chapters?: Record<string, string[]>;
  languages?: string[];
  pan?: string;
};

function cleanList(values: readonly string[] | undefined, max: number, maxLength = 60): string[] | undefined {
  if (!values) return undefined;
  return [...new Set(values.map((v) => v.trim()).filter((v) => v.length > 0 && v.length <= maxLength))].slice(0, max);
}

/** Creates the draft on first call (a rejected applicant may start again) and applies edits. */
export async function saveApplication(userId: string, patch: ApplicationPatch): Promise<ApplicationView> {
  await ensureNowSchema();
  let row = await latestApplication(userId);
  if (row?.status === "submitted") throw new NowError(409, "under_review", "Your application is under review and cannot be changed.");
  if (row?.status === "approved") throw new NowError(409, "already_approved", "You are already an approved solver.");
  if (patch.role !== undefined && !(HELPER_ROLES as readonly string[]).includes(patch.role)) {
    throw new NowError(400, "invalid", "Choose a valid role.");
  }
  const subjects = cleanList(patch.subjects, 4)?.map((s) => s.toLowerCase());
  if (subjects && subjects.some((s) => !isNowSubject(s))) throw new NowError(400, "invalid", "Unknown subject.");
  const languages = cleanList(patch.languages, 8, 30)?.map((l) => l.toLowerCase());
  let chapters: Record<string, string[]> | undefined;
  if (patch.chapters) {
    chapters = {};
    for (const [subject, list] of Object.entries(patch.chapters)) {
      if (isNowSubject(subject)) chapters[subject] = cleanList(list, 60, 120) ?? [];
    }
  }
  let panEncrypted: string | undefined;
  let panLast4: string | undefined;
  if (patch.pan !== undefined) {
    const pan = normalizePan(patch.pan);
    if (!pan) throw new NowError(400, "invalid_pan", "Enter a valid PAN (for example ABCDE1234F).");
    if (!isKycEncryptionConfigured()) throw new NowError(503, "kyc_unavailable", "PAN cannot be saved right now. Please try later.");
    panEncrypted = encryptKyc(pan);
    panLast4 = pan.slice(-4);
  }
  if (!row || row.status === "rejected") {
    const role = (patch.role as HelperRole | undefined) ?? "other";
    const inserted = await pool().query<ApplicationRow>(
      `INSERT INTO now.helper_applications (id, user_id, role, display_name, subjects, chapters, languages, pan_encrypted, pan_last4)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9) RETURNING *`,
      [
        createPrefixedId("happ"),
        userId,
        role,
        patch.displayName?.trim().slice(0, 60) ?? "",
        subjects ?? [],
        JSON.stringify(chapters ?? {}),
        languages ?? [],
        panEncrypted ?? null,
        panLast4 ?? null,
      ],
    );
    row = inserted.rows[0];
  } else {
    const updated = await pool().query<ApplicationRow>(
      `UPDATE now.helper_applications SET
         role = COALESCE($2, role),
         display_name = COALESCE($3, display_name),
         subjects = COALESCE($4, subjects),
         chapters = COALESCE($5::jsonb, chapters),
         languages = COALESCE($6, languages),
         pan_encrypted = COALESCE($7, pan_encrypted),
         pan_last4 = COALESCE($8, pan_last4),
         updated_at = NOW()
       WHERE id = $1 AND status = 'draft' RETURNING *`,
      [
        row.id,
        patch.role ?? null,
        patch.displayName?.trim().slice(0, 60) ?? null,
        subjects ?? null,
        chapters ? JSON.stringify(chapters) : null,
        languages ?? null,
        panEncrypted ?? null,
        panLast4 ?? null,
      ],
    );
    if (!updated.rows[0]) throw new NowError(409, "under_review", "Your application can no longer be changed.");
    row = updated.rows[0];
  }
  return toView(row);
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** Step 1 of an upload: a presigned PUT into the applicant's private folder. */
export async function createDocumentUpload(
  userId: string,
  input: { kind: string; mimeType: string; sizeBytes: number },
): Promise<{ uploadUrl: string; objectKey: string; expiresInSeconds: number }> {
  await openDraft(userId);
  if (!(DOCUMENT_KINDS as readonly string[]).includes(input.kind)) throw new NowError(400, "invalid", "Unknown document type.");
  if (!(ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(input.mimeType)) {
    throw new NowError(400, "invalid_file_type", "Upload a JPG, PNG, WebP or PDF.");
  }
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > MAX_DOCUMENT_BYTES) {
    throw new NowError(400, "file_too_large", "Each file must be 5 MB or smaller.");
  }
  const objectKey = `${KYC_PREFIX}/${userId}/${input.kind}-${randomUUID()}.${EXTENSIONS[input.mimeType]}`;
  // KYC documents never go to the public image bucket (B96).
  const bucket = requirePrivateFilesBucket();
  try {
    const signed = createPresignedR2PutUrl({ objectKey, bucket, expiresSeconds: 600, method: "PUT" });
    return { uploadUrl: signed.url, objectKey, expiresInSeconds: 600 };
  } catch {
    throw new NowError(503, "storage_unavailable", "Uploads are not available right now. Please try later.");
  }
}

/** Step 2: record the uploaded key. Only keys inside the applicant's own folder are accepted. */
export async function confirmDocumentUpload(userId: string, input: { kind: string; objectKey: string }): Promise<ApplicationView> {
  const row = await openDraft(userId);
  if (!(DOCUMENT_KINDS as readonly string[]).includes(input.kind)) throw new NowError(400, "invalid", "Unknown document type.");
  const expectedPrefix = `${KYC_PREFIX}/${userId}/${input.kind}-`;
  if (!input.objectKey.startsWith(expectedPrefix) || input.objectKey.includes("..")) {
    throw new NowError(400, "invalid", "That upload does not belong to this application.");
  }
  const previous = row.documents[input.kind as DocumentKind];
  const updated = await pool().query<ApplicationRow>(
    `UPDATE now.helper_applications
        SET documents = documents || jsonb_build_object($2::text, $3::text), updated_at = NOW()
      WHERE id = $1 AND status = 'draft' RETURNING *`,
    [row.id, input.kind, input.objectKey],
  );
  if (previous && previous !== input.objectKey) await deletePrivateFile(previous);
  return toView(updated.rows[0]);
}

export async function acceptAgreement(userId: string, version: string): Promise<ApplicationView> {
  const row = await openDraft(userId);
  const { agreementVersion } = await getNowSettings();
  if (version !== agreementVersion) throw new NowError(409, "agreement_changed", "The Helper Agreement was updated. Please read the new version.");
  const updated = await pool().query<ApplicationRow>(
    `UPDATE now.helper_applications SET agreement_version = $2, agreement_accepted_at = NOW(), updated_at = NOW()
      WHERE id = $1 RETURNING *`,
    [row.id, version],
  );
  return toView(updated.rows[0]);
}

// ---------------------------------------------------------------------------
// Subject quiz.

export type QuizForApplicant = {
  attemptId: string;
  subject: string;
  expiresAt: string;
  questions: { id: string; text: string; options: string[]; image: string | null }[];
};

export async function startQuiz(userId: string, subject: string, now: Date = new Date()): Promise<QuizForApplicant> {
  const row = await openDraft(userId);
  const wanted = subject.toLowerCase();
  if (!isNowSubject(wanted) || !row.subjects.includes(wanted)) {
    throw new NowError(400, "invalid", "Add this subject to your application before taking its quiz.");
  }
  const last = await pool().query<{ started_at: Date }>(
    `SELECT started_at FROM now.quiz_attempts WHERE user_id = $1 AND subject = $2 ORDER BY started_at DESC LIMIT 1`,
    [userId, wanted],
  );
  const allowedAt = nextQuizAllowedAt(last.rows[0]?.started_at ?? null);
  if (allowedAt && allowedAt.getTime() > now.getTime()) {
    throw new NowError(429, "quiz_cooldown", `You can retake the ${wanted} quiz after ${formatISTDateTimeDMY(allowedAt)}.`);
  }
  const { quiz } = await getNowSettings();
  const sampled = await sampleOgcodeCatalogQuestionIds({
    subject: wanted,
    type: "mcq",
    seed: `${userId}:${wanted}:${now.getTime()}`,
    limit: quiz.questions * 3,
  });
  const map = await getOgcodeCatalogQuestionMap(sampled.map((s) => s.id));
  const usable = [...map.values()].filter(
    (q) => typeof q.correctOption === "number" && Array.isArray(q.options) && q.options.length >= 2,
  );
  if (usable.length < quiz.questions) {
    throw new NowError(503, "quiz_unavailable", "The quiz is not available for this subject yet.");
  }
  const picked = usable.slice(0, quiz.questions);
  const attemptId = createPrefixedId("quiz");
  const expiresAt = new Date(now.getTime() + quiz.minutes * 60_000);
  await pool().query(
    `INSERT INTO now.quiz_attempts (id, user_id, subject, question_ids, total, started_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [attemptId, userId, wanted, picked.map((q) => q.id), picked.length, now, expiresAt],
  );
  return {
    attemptId,
    subject: wanted,
    expiresAt: expiresAt.toISOString(),
    questions: picked.map((q) => ({ id: q.id, text: q.text, options: q.options ?? [], image: q.image ?? null })),
  };
}

export async function submitQuiz(
  userId: string,
  attemptId: string,
  answers: Record<string, number | null>,
  now: Date = new Date(),
): Promise<{ percent: number; passed: boolean; application: ApplicationView }> {
  const row = await openDraft(userId);
  const attempt = await pool().query<{ id: string; subject: string; question_ids: string[]; expires_at: Date; submitted_at: Date | null }>(
    `SELECT id, subject, question_ids, expires_at, submitted_at FROM now.quiz_attempts WHERE id = $1 AND user_id = $2`,
    [attemptId, userId],
  );
  const a = attempt.rows[0];
  if (!a) throw new NowError(404, "not_found", "Quiz attempt not found.");
  if (a.submitted_at) throw new NowError(409, "already_submitted", "This quiz was already submitted.");
  if (isQuizExpired(a.expires_at, now)) throw new NowError(410, "quiz_expired", "Time is up for this quiz. You can retake it after 24 hours.");
  const map = await getOgcodeCatalogQuestionMap(a.question_ids);
  const questions = a.question_ids
    .map((id) => map.get(id))
    .filter((q): q is NonNullable<typeof q> => Boolean(q) && typeof q!.correctOption === "number")
    .map((q) => ({ id: q.id, correctOption: q.correctOption as number }));
  const graded = gradeQuiz(questions, answers);
  const { quiz } = await getNowSettings();
  const claimed = await pool().query(
    `UPDATE now.quiz_attempts SET answers = $2::jsonb, score = $3, submitted_at = $4 WHERE id = $1 AND submitted_at IS NULL`,
    [a.id, JSON.stringify(answers), graded.score, now],
  );
  if (claimed.rowCount === 0) throw new NowError(409, "already_submitted", "This quiz was already submitted.");
  const best = Math.max(graded.percent, row.quiz_scores[a.subject] ?? 0);
  const updated = await pool().query<ApplicationRow>(
    `UPDATE now.helper_applications
        SET quiz_scores = quiz_scores || jsonb_build_object($2::text, $3::int), updated_at = NOW()
      WHERE id = $1 RETURNING *`,
    [row.id, a.subject, best],
  );
  return { percent: graded.percent, passed: graded.percent >= quiz.passPercent, application: await toView(updated.rows[0]) };
}

export async function submitApplication(userId: string): Promise<ApplicationView> {
  const row = await openDraft(userId);
  const view = await toView(row);
  if (!view.readiness.ready) throw new NowError(400, "not_ready", view.readiness.missing.join(" "));
  const consent = view.isMinor
    ? await pool().query<{ id: string }>(
        `SELECT id FROM app.guardian_consents WHERE user_id = $1 AND purpose = 'solver' AND withdrawn_at IS NULL
          ORDER BY consented_at DESC LIMIT 1`,
        [userId],
      )
    : null;
  const updated = await pool().query<ApplicationRow>(
    `UPDATE now.helper_applications
        SET status = 'submitted', submitted_at = NOW(), guardian_consent_id = $2, updated_at = NOW()
      WHERE id = $1 AND status = 'draft' RETURNING *`,
    [row.id, consent?.rows[0]?.id ?? null],
  );
  if (!updated.rows[0]) throw new NowError(409, "under_review", "Your application was already submitted.");
  await pool().query(`INSERT INTO now.events (type, actor, payload) VALUES ('application.submitted', $1, $2::jsonb)`, [
    userId,
    JSON.stringify({ applicationId: row.id }),
  ]);
  return toView(updated.rows[0]);
}

// ---------------------------------------------------------------------------
// Admin review.

export type AdminApplicationSummary = {
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
  role: HelperRole;
  displayName: string;
  subjects: string[];
  status: ApplicationStatus;
  submittedAt: string | null;
  isMinor: boolean;
};

export async function listApplicationsForAdmin(status: ApplicationStatus = "submitted"): Promise<AdminApplicationSummary[]> {
  await ensureNowSchema();
  const res = await pool().query<ApplicationRow & { name: string | null; email: string | null; date_of_birth: Date | null }>(
    `SELECT a.*, u.name, u.email, u.date_of_birth FROM now.helper_applications a
       JOIN origin_users u ON u.id = a.user_id
      WHERE a.status = $1 ORDER BY a.submitted_at NULLS LAST, a.created_at LIMIT 200`,
    [status],
  );
  return res.rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    name: r.name,
    email: r.email,
    role: r.role,
    displayName: r.display_name,
    subjects: r.subjects,
    status: r.status,
    submittedAt: r.submitted_at ? r.submitted_at.toISOString() : null,
    isMinor: isMinorOn(r.date_of_birth, new Date()),
  }));
}

/** Full application for review, with 10-minute signed links to each document. */
export async function getApplicationForAdmin(applicationId: string): Promise<
  ApplicationView & { userId: string; documentLinks: Partial<Record<DocumentKind, string>>; demoPassed: boolean | null }
> {
  await ensureNowSchema();
  const res = await pool().query<ApplicationRow>(`SELECT * FROM now.helper_applications WHERE id = $1`, [applicationId]);
  const row = res.rows[0];
  if (!row) throw new NowError(404, "not_found", "Application not found.");
  const documentLinks: Partial<Record<DocumentKind, string>> = {};
  const privateBucket = getPrivateFilesBucket().name;
  for (const [kind, key] of Object.entries(row.documents)) {
    if (!privateBucket) break; // No private bucket: listed without links.
    try {
      documentLinks[kind as DocumentKind] = createPresignedR2PutUrl({
        objectKey: key as string,
        bucket: privateBucket,
        method: "GET",
        expiresSeconds: 600,
      }).url;
    } catch {
      // Storage not configured (local dev): the admin sees the document listed without a link.
    }
  }
  return { ...(await toView(row)), userId: row.user_id, documentLinks, demoPassed: row.demo_passed };
}

/**
 * Approves an application: one transaction writes the helper row (copying the
 * agreement acceptance and minor flag) and one expertise row per subject or
 * chapter. Re-approving an already-approved application is refused.
 */
export async function approveApplication(input: {
  applicationId: string;
  adminId: string;
  demoPassed: boolean;
  level?: "trainee" | "verified" | "expert";
}): Promise<{ helperId: string }> {
  if (!input.demoPassed) throw new NowError(400, "demo_required", "Approve only after the demo doubt has been reviewed and passed.");
  await ensureNowSchema();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const res = await client.query<ApplicationRow & { date_of_birth: Date | null }>(
      `SELECT a.*, u.date_of_birth FROM now.helper_applications a JOIN origin_users u ON u.id = a.user_id
        WHERE a.id = $1 FOR UPDATE OF a`,
      [input.applicationId],
    );
    const app = res.rows[0];
    if (!app) throw new NowError(404, "not_found", "Application not found.");
    if (app.status !== "submitted") throw new NowError(409, "not_submitted", `Application is ${app.status}, not submitted.`);
    const isMinor = isMinorOn(app.date_of_birth, new Date());
    if (isMinor && !app.guardian_consent_id) throw new NowError(409, "needs_consent", "An under-18 solver needs guardian consent.");
    const helperId = createPrefixedId("helper");
    const settings = await getNowSettings();
    await client.query(
      `INSERT INTO now.helpers
         (id, user_id, kind, role, display_name, verification_status, is_minor, languages, agreement_version,
          agreement_accepted_at, application_id, verified_at, reverify_by)
       VALUES ($1, $2, 'human', $3, $4, 'verified', $5, $6, $7, $8, $9, NOW(), NOW() + interval '12 months')
       ON CONFLICT (user_id) DO UPDATE SET
         verification_status = 'verified', role = EXCLUDED.role, display_name = EXCLUDED.display_name,
         is_minor = EXCLUDED.is_minor, languages = EXCLUDED.languages,
         agreement_version = EXCLUDED.agreement_version, agreement_accepted_at = EXCLUDED.agreement_accepted_at,
         application_id = EXCLUDED.application_id, restricted_reason = NULL,
         verified_at = NOW(), reverify_by = NOW() + interval '12 months', updated_at = NOW()`,
      [
        helperId,
        app.user_id,
        app.role,
        app.display_name,
        isMinor,
        app.languages,
        app.agreement_version ?? settings.agreementVersion,
        app.agreement_accepted_at,
        app.id,
      ],
    );
    const helper = await client.query<{ id: string }>(`SELECT id FROM now.helpers WHERE user_id = $1`, [app.user_id]);
    const finalId = helper.rows[0].id;
    await client.query(`DELETE FROM now.helper_expertise WHERE helper_id = $1`, [finalId]);
    const level = input.level ?? "verified";
    for (const subject of app.subjects) {
      const chapters = app.chapters[subject] ?? [];
      const rows = chapters.length > 0 ? chapters : [""];
      for (const chapter of rows) {
        await client.query(
          `INSERT INTO now.helper_expertise (helper_id, subject, chapter, level) VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING`,
          [finalId, subject, chapter, level],
        );
      }
    }
    await client.query(
      `UPDATE now.helper_applications SET status = 'approved', demo_passed = TRUE, reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW()
        WHERE id = $1`,
      [app.id, input.adminId],
    );
    await client.query(`INSERT INTO now.events (type, actor, payload) VALUES ('application.approved', $1, $2::jsonb)`, [
      input.adminId,
      JSON.stringify({ applicationId: app.id, helperId: finalId, userId: app.user_id, isMinor }),
    ]);
    await client.query("COMMIT");
    return { helperId: finalId };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function rejectApplication(input: { applicationId: string; adminId: string; reason: string }): Promise<void> {
  const reason = input.reason.trim();
  if (reason.length < 5) throw new NowError(400, "invalid", "Give the applicant a reason (at least 5 characters).");
  await ensureNowSchema();
  const res = await pool().query<{ user_id: string; documents: Record<string, string> }>(
    `UPDATE now.helper_applications
        SET status = 'rejected', reject_reason = $3, reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND status = 'submitted' RETURNING user_id, documents`,
    [input.applicationId, input.adminId, reason.slice(0, 500)],
  );
  const row = res.rows[0];
  if (!row) throw new NowError(409, "not_submitted", "Only a submitted application can be rejected.");
  // Plan doc, "Aadhaar handling": documents are deleted when an application is rejected.
  for (const key of Object.values(row.documents)) await deletePrivateFile(key);
  await pool().query(`UPDATE now.helper_applications SET documents = '{}'::jsonb WHERE id = $1`, [input.applicationId]);
  await pool().query(`INSERT INTO now.events (type, actor, payload) VALUES ('application.rejected', $1, $2::jsonb)`, [
    input.adminId,
    JSON.stringify({ applicationId: input.applicationId, userId: row.user_id }),
  ]);
}

/** The Origin bot's helper row: one per database, expert in every subject. */
export async function ensureBotHelper(): Promise<string> {
  await ensureNowSchema();
  await pool().query(
    `INSERT INTO now.helpers (id, user_id, kind, display_name, verification_status, languages, agreement_version, agreement_accepted_at)
     VALUES ($1, NULL, 'bot', 'Origin', 'verified', ARRAY['english', 'hindi'], 'bot', NOW())
     ON CONFLICT DO NOTHING`,
    [BOT_HELPER_ID],
  );
  for (const subject of ["physics", "chemistry", "mathematics", "biology"]) {
    await pool().query(
      `INSERT INTO now.helper_expertise (helper_id, subject, chapter, level) VALUES ($1, $2, '', 'expert') ON CONFLICT DO NOTHING`,
      [BOT_HELPER_ID, subject],
    );
  }
  return BOT_HELPER_ID;
}
