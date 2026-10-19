/**
 * Guardian consent for minors (plan doc, "Children's data law" risk row; the
 * children's policy page already promises date of birth at signup and a
 * guardian who verifies before activation).
 *
 * Flow: the student (or under-18 solver applicant) gives their date of birth
 * and a guardian's name, email and relationship → we email the guardian a
 * single-use link (72 h) → the guardian opens /now/consent, ticks the policy
 * and confirms → an `app.guardian_consents` row is written. Only the token
 * hash is stored. Phone OTP and DigiLocker-style adult verification are a
 * later step (needed before the DPDP children's rule applies in 2027).
 */

import { sendEmail } from "@/server/email";
import { absoluteHref } from "@/server/email/assets";
import { detailsCard, infoStrip, paragraph, renderEmail } from "@/server/email/layout";
import { createPrefixedId } from "@/server/workspaces/ids";
import { getUserPostgresPool } from "@/server/user-postgres";

import { isMinorOn } from "./now-access";
import { NowError } from "./now-http";
import { ensureNowSchema } from "./now-schema";
import {
  CONSENT_LINK_TTL_MS,
  GUARDIAN_RELATIONSHIPS,
  hashConsentToken,
  newConsentToken,
  validateDateOfBirth,
  type GuardianRelationship,
} from "./solver-rules";

/** Bump when the consent wording on /now/consent changes. */
export const CONSENT_POLICY_VERSION = "2026-10-origin-now-v1";

export type ConsentPurpose = "student" | "solver";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type StartConsentInput = {
  userId: string;
  purpose: ConsentPurpose;
  dateOfBirth: string | null;
  guardianName: string;
  guardianEmail: string;
  guardianPhone: string | null;
  relationship: string;
  now?: Date;
};

export type ConsentStatus = {
  dateOfBirth: string | null;
  isMinor: boolean;
  student: { consented: boolean; pendingSentTo: string | null };
  solver: { consented: boolean; pendingSentTo: string | null };
};

export async function getConsentStatus(userId: string, now: Date = new Date()): Promise<ConsentStatus> {
  await ensureNowSchema();
  const [user, consents, pending] = await Promise.all([
    pool().query<{ date_of_birth: Date | null }>(`SELECT date_of_birth FROM origin_users WHERE id = $1`, [userId]),
    pool().query<{ purpose: ConsentPurpose }>(
      `SELECT DISTINCT purpose FROM app.guardian_consents WHERE user_id = $1 AND withdrawn_at IS NULL`,
      [userId],
    ),
    pool().query<{ purpose: ConsentPurpose; guardian_email: string }>(
      `SELECT DISTINCT ON (purpose) purpose, guardian_email FROM now.consent_requests
        WHERE user_id = $1 AND confirmed_at IS NULL AND expires_at > $2
        ORDER BY purpose, created_at DESC`,
      [userId, now],
    ),
  ]);
  const dob = user.rows[0]?.date_of_birth ?? null;
  const consented = new Set(consents.rows.map((r) => r.purpose));
  const pendingBy = new Map(pending.rows.map((r) => [r.purpose, r.guardian_email]));
  const maskEmail = (e: string | undefined) => (e ? e.replace(/^(.).*(@.*)$/, "$1***$2") : null);
  return {
    dateOfBirth: dob ? dob.toISOString().slice(0, 10) : null,
    isMinor: isMinorOn(dob, now),
    student: { consented: consented.has("student"), pendingSentTo: maskEmail(pendingBy.get("student")) },
    solver: { consented: consented.has("solver"), pendingSentTo: maskEmail(pendingBy.get("solver")) },
  };
}

/**
 * Records the date of birth (once; changing it later is an admin action) and,
 * for a minor, emails the guardian a consent link. An adult needs no consent.
 */
export async function startGuardianConsent(input: StartConsentInput): Promise<{ needsConsent: boolean; sentTo: string | null }> {
  const now = input.now ?? new Date();
  await ensureNowSchema();
  const existing = await pool().query<{ date_of_birth: Date | null; name: string | null }>(
    `SELECT date_of_birth, name FROM origin_users WHERE id = $1`,
    [input.userId],
  );
  if (!existing.rows[0]) throw new NowError(404, "not_found", "Account not found.");
  let dob = existing.rows[0].date_of_birth;
  if (!dob) {
    const parsed = input.dateOfBirth ? validateDateOfBirth(input.dateOfBirth, now) : null;
    if (!parsed) throw new NowError(400, "invalid_dob", "Enter a valid date of birth (YYYY-MM-DD).");
    await pool().query(`UPDATE origin_users SET date_of_birth = $2 WHERE id = $1 AND date_of_birth IS NULL`, [
      input.userId,
      parsed,
    ]);
    dob = parsed;
  }
  if (!isMinorOn(dob, now)) return { needsConsent: false, sentTo: null };

  const guardianName = input.guardianName.trim();
  const guardianEmail = input.guardianEmail.trim().toLowerCase();
  if (guardianName.length < 2 || guardianName.length > 80) throw new NowError(400, "invalid", "Enter the guardian's full name.");
  if (!EMAIL_PATTERN.test(guardianEmail)) throw new NowError(400, "invalid", "Enter the guardian's email address.");
  if (!(GUARDIAN_RELATIONSHIPS as readonly string[]).includes(input.relationship)) {
    throw new NowError(400, "invalid", "Choose how the guardian is related to you.");
  }
  const self = await pool().query<{ email: string | null }>(`SELECT email FROM origin_users WHERE id = $1`, [input.userId]);
  if (self.rows[0]?.email?.toLowerCase() === guardianEmail) {
    throw new NowError(400, "guardian_is_self", "The guardian's email must be different from yours.");
  }
  const recent = await pool().query<{ n: number }>(
    `SELECT count(*)::int AS n FROM now.consent_requests WHERE user_id = $1 AND created_at > $2`,
    [input.userId, new Date(now.getTime() - 24 * 60 * 60_000)],
  );
  if ((recent.rows[0]?.n ?? 0) >= 5) {
    throw new NowError(429, "too_many_requests", "Too many consent emails today. Try again tomorrow.");
  }

  const { token, hash } = newConsentToken();
  await pool().query(
    `INSERT INTO now.consent_requests
       (id, user_id, purpose, guardian_name, guardian_email, guardian_phone, relationship, token_hash, policy_version, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      createPrefixedId("crq"),
      input.userId,
      input.purpose,
      guardianName,
      guardianEmail,
      input.guardianPhone?.trim() || null,
      input.relationship,
      hash,
      CONSENT_POLICY_VERSION,
      new Date(now.getTime() + CONSENT_LINK_TTL_MS),
    ],
  );
  const email = renderConsentEmail({
    guardianName,
    childName: existing.rows[0].name ?? "Your child",
    purpose: input.purpose,
    link: absoluteHref(`/now/consent?token=${encodeURIComponent(token)}`),
  });
  const sent = await sendEmail({ to: guardianEmail, ...email });
  if (!sent.success) throw new NowError(502, "email_failed", "We could not send the email. Please try again.");
  return { needsConsent: true, sentTo: guardianEmail.replace(/^(.).*(@.*)$/, "$1***$2") };
}

export type ConsentPreview = {
  childName: string;
  guardianName: string;
  purpose: ConsentPurpose;
  relationship: GuardianRelationship;
  expired: boolean;
  alreadyConfirmed: boolean;
};

async function findRequest(token: string) {
  await ensureNowSchema();
  const res = await pool().query<{
    id: string;
    user_id: string;
    purpose: ConsentPurpose;
    guardian_name: string;
    guardian_email: string;
    guardian_phone: string | null;
    relationship: GuardianRelationship;
    policy_version: string;
    expires_at: Date;
    confirmed_at: Date | null;
    child_name: string | null;
  }>(
    `SELECT r.*, u.name AS child_name FROM now.consent_requests r
       JOIN origin_users u ON u.id = r.user_id
      WHERE r.token_hash = $1`,
    [hashConsentToken(token)],
  );
  return res.rows[0] ?? null;
}

/** What the guardian sees before confirming. Public: the token is the credential. */
export async function previewConsent(token: string, now: Date = new Date()): Promise<ConsentPreview> {
  const row = await findRequest(token);
  if (!row) throw new NowError(404, "invalid_link", "This consent link is not valid.");
  return {
    childName: row.child_name ?? "your child",
    guardianName: row.guardian_name,
    purpose: row.purpose,
    relationship: row.relationship,
    expired: row.expires_at.getTime() <= now.getTime(),
    alreadyConfirmed: Boolean(row.confirmed_at),
  };
}

/** Guardian confirms. Single use; writes the consent row in the same transaction. */
export async function confirmConsent(input: {
  token: string;
  acceptedPolicy: boolean;
  now?: Date;
}): Promise<{ purpose: ConsentPurpose }> {
  const now = input.now ?? new Date();
  if (!input.acceptedPolicy) throw new NowError(400, "policy_not_accepted", "Please tick the box to give consent.");
  await ensureNowSchema();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const res = await client.query<{
      id: string;
      user_id: string;
      purpose: ConsentPurpose;
      guardian_name: string;
      guardian_email: string;
      guardian_phone: string | null;
      relationship: string;
      policy_version: string;
      expires_at: Date;
      confirmed_at: Date | null;
    }>(`SELECT * FROM now.consent_requests WHERE token_hash = $1 FOR UPDATE`, [hashConsentToken(input.token)]);
    const row = res.rows[0];
    if (!row) throw new NowError(404, "invalid_link", "This consent link is not valid.");
    if (row.confirmed_at) {
      await client.query("COMMIT");
      return { purpose: row.purpose };
    }
    if (row.expires_at.getTime() <= now.getTime()) throw new NowError(410, "link_expired", "This link has expired. Ask for a new one.");
    const consentId = createPrefixedId("gcon");
    await client.query(
      `INSERT INTO app.guardian_consents
         (id, user_id, purpose, guardian_name, guardian_email, guardian_phone, relationship, verified_via, policy_version, consented_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'email_otp', $8, $9)`,
      [
        consentId,
        row.user_id,
        row.purpose,
        row.guardian_name,
        row.guardian_email,
        row.guardian_phone,
        row.relationship,
        row.policy_version,
        now,
      ],
    );
    await client.query(`UPDATE now.consent_requests SET confirmed_at = $2, consent_id = $3 WHERE id = $1`, [
      row.id,
      now,
      consentId,
    ]);
    await client.query(
      `INSERT INTO now.events (type, actor, payload) VALUES ('consent.confirmed', 'guardian', $1::jsonb)`,
      [JSON.stringify({ userId: row.user_id, purpose: row.purpose, consentId })],
    );
    await client.query("COMMIT");
    return { purpose: row.purpose };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Student-side withdrawal is not offered; a guardian withdraws through support (admin). */
export async function withdrawConsent(userId: string, purpose: ConsentPurpose): Promise<void> {
  await ensureNowSchema();
  await pool().query(
    `UPDATE app.guardian_consents SET withdrawn_at = NOW() WHERE user_id = $1 AND purpose = $2 AND withdrawn_at IS NULL`,
    [userId, purpose],
  );
}

export function renderConsentEmail(input: {
  guardianName: string;
  childName: string;
  purpose: ConsentPurpose;
  link: string;
}): { subject: string; text: string; html: string } {
  const what =
    input.purpose === "student"
      ? "join short live doubt-solving calls with verified Origin teachers"
      : "help other students as an Origin doubt solver";
  const subject = `Consent needed: ${input.childName} on Origin NOW`;
  const text = [
    `Dear ${input.guardianName},`,
    ``,
    `${input.childName} would like to ${what} on Origin NOW.`,
    `Calls are audio-only, recorded for safety and kept for 30 days, and contact details are never shared.`,
    ``,
    `To review and give consent, open: ${input.link}`,
    `The link expires in 72 hours. If you did not expect this email, ignore it and nothing will change.`,
  ].join("\n");
  const html = renderEmail({
    preheader: `${input.childName} needs your consent to use Origin NOW.`,
    documentTitle: "Origin - Parental consent",
    mascot: "curious",
    title: "Your consent",
    titleAccent: "is needed",
    intro: [`${input.childName} would like to ${what}.`],
    blocks: [
      detailsCard("How Origin NOW works", [
        { label: "Calls", value: "Audio only, student camera off" },
        { label: "Safety", value: "Every call recorded, kept 30 days" },
        { label: "Privacy", value: "No phone numbers or contact details shared" },
      ]),
      infoStrip("Only you can give this consent.", "The link works once and expires in 72 hours.", "info"),
      paragraph("If you did not expect this email, ignore it and nothing will change.", { muted: true, size: 13, align: "center" }),
    ],
    cta: { label: "Review and give consent", href: input.link },
    footerNote: "You received this because your email was given as a parent or guardian on Origin.",
  });
  return { subject, text, html };
}
