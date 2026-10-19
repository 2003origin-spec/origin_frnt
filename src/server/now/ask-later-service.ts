/**
 * "Ask later" (decision B94): help without a live call.
 *
 *   post (coins held) → a solver claims it (30 min) → answers in writing
 *   → the student accepts (stars, tip) → coins to the solver (pending 24 h)
 *
 * Unanswered by the deadline → coins back. Not accepted or reported within
 * 48 h of the answer → accepted. Reported → a case in the reports queue;
 * upheld refunds the student, dismissed pays the solver. Photos live in the
 * private bucket and are only shown through 10-minute signed links. Rules in
 * ask-later-rules.ts; off until Settings → Extra parts → "Ask later".
 */

import { randomBytes } from "node:crypto";

import { sendEmail } from "@/server/email";
import { paragraph, renderEmail } from "@/server/email/layout";
import { createPresignedR2PutUrl } from "@/server/media-storage";
import { getOgcodeCatalogQuestionById } from "@/server/ogcode-catalog";
import { getOgcodeQuestionProgress, isOgcodeProgressAvailable } from "@/server/ogcode-progress";
import { getUserPostgresPool } from "@/server/user-postgres";
import { createPrefixedId } from "@/server/workspaces/ids";

import { loadPriceTable } from "./admin-store";
import { REPORT_REASONS, type ReportReason } from "./after-call-rules";
import {
  PHOTO_MAX_BYTES,
  PHOTO_TYPES,
  answerProblems,
  askLaterPrice,
  noteProblems,
  photoKeysProblem,
  type AskLaterStatus,
} from "./ask-later-rules";
import { logEvent } from "./dispatch-service";
import { sessionCapture, sessionHold, sessionRelease, tip as tipTransfer, type Transfer } from "./ledger-rules";
import { getWalletBalance, postTransfers, withNowTransaction } from "./ledger-store";
import { getNowAccess } from "./now-access";
import { NowError } from "./now-http";
import { ensureNowSchema } from "./now-schema";
import { getNowSettings } from "./now-settings";
import { lookupPrice } from "./pricing";
import { getPrivateFilesBucket, requirePrivateFilesBucket } from "./private-files";
import { firstNameOnly } from "./session-rules";
import { isNowSubject } from "./solver-rules";
import { normalizeDifficulty } from "./types";
import { ensureWelcomeGrant } from "./wallet-service";

const HOUR = 60 * 60_000;

async function db() {
  await ensureNowSchema();
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

async function requireAskLater() {
  const settings = await getNowSettings();
  if (!settings.features.askLater) throw new NowError(404, "ask_later_off", "Ask later is not switched on.");
  return settings;
}

type Row = {
  id: string;
  student_id: string;
  question_id: string;
  subject: string;
  chapter: string | null;
  difficulty: string;
  context_json: { question?: { text?: string; options?: string[]; image?: string | null } };
  note: string | null;
  photo_keys: string[];
  price_coins: number;
  status: AskLaterStatus;
  helper_id: string | null;
  claimed_at: Date | null;
  claim_expires_at: Date | null;
  answer_text: string | null;
  answer_photo_keys: string[];
  answered_at: Date | null;
  stars: number | null;
  tip_coins: number;
  settled_at: Date | null;
  settle_outcome: "paid" | "refunded" | null;
  expires_at: Date;
  created_at: Date;
};

export type LaterView = {
  id: string;
  subject: string;
  chapter: string | null;
  difficulty: string;
  question: { text: string; options: string[]; image: string | null };
  note: string | null;
  photos: string[];
  priceCoins: number;
  status: AskLaterStatus;
  /** Student view: the solver's display name once claimed. Solver view: the student's first name. */
  otherName: string | null;
  answer: { text: string; photos: string[]; at: string } | null;
  stars: number | null;
  tipCoins: number;
  expiresAt: string;
  claimExpiresAt: string | null;
  createdAt: string;
  /** Student: may cancel (nobody has claimed it). */
  canCancel: boolean;
  /** Student: may accept or report the answer. */
  canRespond: boolean;
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);

function photoLinks(keys: readonly string[]): string[] {
  const bucket = getPrivateFilesBucket().name;
  if (!bucket) return [];
  const out: string[] = [];
  for (const key of keys) {
    try {
      out.push(createPresignedR2PutUrl({ objectKey: key, bucket, method: "GET", expiresSeconds: 600 }).url);
    } catch {
      // Storage not configured (local dev): the photo is simply not shown.
    }
  }
  return out;
}

function toView(r: Row, otherName: string | null, viewer: "student" | "solver" | "admin"): LaterView {
  const q = r.context_json?.question ?? {};
  const showAnswer = r.answer_text !== null && (viewer !== "student" || ["answered", "accepted", "disputed"].includes(r.status));
  return {
    id: r.id,
    subject: r.subject,
    chapter: r.chapter,
    difficulty: r.difficulty,
    question: { text: q.text ?? "", options: q.options ?? [], image: q.image ?? null },
    note: r.note,
    photos: photoLinks(r.photo_keys),
    priceCoins: r.price_coins,
    status: r.status,
    otherName,
    answer: showAnswer ? { text: r.answer_text!, photos: photoLinks(r.answer_photo_keys), at: iso(r.answered_at)! } : null,
    stars: r.stars,
    tipCoins: r.tip_coins,
    expiresAt: r.expires_at.toISOString(),
    claimExpiresAt: iso(r.claim_expires_at),
    createdAt: r.created_at.toISOString(),
    canCancel: viewer === "student" && r.status === "open",
    canRespond: viewer === "student" && r.status === "answered",
  };
}

// ---------------------------------------------------------------------------
// Student.

export type LaterQuote = { enabled: boolean; priceCoins: number | null; answerHours: number; balance: number; open: number; maxOpen: number };

export async function quoteAskLater(studentId: string, questionId: string): Promise<LaterQuote> {
  const settings = await getNowSettings();
  const config = settings.askLater;
  if (!settings.features.askLater) return { enabled: false, priceCoins: null, answerHours: config.answerHours, balance: 0, open: 0, maxOpen: config.maxOpenPerStudent };
  const question = await getOgcodeCatalogQuestionById(questionId);
  const difficulty = question ? normalizeDifficulty(question.difficulty) : null;
  const live = difficulty ? lookupPrice((await loadPriceTable()).rows, difficulty, "human") : null;
  const [balance, open] = await Promise.all([getWalletBalance(studentId), countOpen(studentId)]);
  return {
    enabled: true,
    priceCoins: live ? askLaterPrice(live.priceCoins, config.pricePercent) : null,
    answerHours: config.answerHours,
    balance: balance.available,
    open,
    maxOpen: config.maxOpenPerStudent,
  };
}

async function countOpen(studentId: string): Promise<number> {
  const res = await (await db()).query<{ n: number }>(
    `SELECT count(*)::int AS n FROM now.later_requests WHERE student_id = $1 AND status IN ('open', 'claimed', 'answered', 'disputed')`,
    [studentId],
  );
  return res.rows[0].n;
}

/** A 15-minute upload link for a photo: the student's question photo, or the claiming solver's answer photo. */
export async function createLaterPhotoUpload(
  userId: string,
  input: { mimeType: string; sizeBytes: number; laterId?: string | null },
): Promise<{ uploadUrl: string; objectKey: string; contentType: string }> {
  await requireAskLater();
  const ext = PHOTO_TYPES[input.mimeType.toLowerCase()];
  if (!ext || input.sizeBytes <= 0 || input.sizeBytes > PHOTO_MAX_BYTES) {
    throw new NowError(400, "invalid_file", "Upload a JPG, PNG or WebP photo of 8 MB or less.");
  }
  let prefix = `origin-now/ask-later/student/${userId}/`;
  if (input.laterId) {
    const row = (await (await db()).query<{ status: string; helper_user_id: string | null }>(
      `SELECT r.status, h.user_id AS helper_user_id FROM now.later_requests r LEFT JOIN now.helpers h ON h.id = r.helper_id WHERE r.id = $1`,
      [input.laterId],
    )).rows[0];
    if (!row || row.helper_user_id !== userId || row.status !== "claimed") throw new NowError(404, "not_found", "Claim this doubt first.");
    prefix = `origin-now/ask-later/answer/${input.laterId}/`;
  }
  const objectKey = `${prefix}${randomBytes(8).toString("hex")}.${ext}`;
  const signed = createPresignedR2PutUrl({ objectKey, bucket: requirePrivateFilesBucket(), method: "PUT", expiresSeconds: 900 });
  return { uploadUrl: signed.url, objectKey, contentType: input.mimeType };
}

export async function postAskLater(
  studentId: string,
  input: { questionId: string; note?: string | null; photoKeys?: string[] },
  idempotencyKey: string,
  now: Date = new Date(),
): Promise<LaterView> {
  const settings = await requireAskLater();
  const config = settings.askLater;
  const access = await getNowAccess(studentId, now);
  if (!access.canRequest) {
    throw new NowError(403, access.blockedReason ?? "not_invited", "Origin NOW is not open for this account yet.");
  }
  await ensureWelcomeGrant(studentId);
  const existing = await (await db()).query<{ id: string }>(
    `SELECT id FROM now.later_requests WHERE student_id = $1 AND idempotency_key = $2`,
    [studentId, idempotencyKey],
  );
  if (existing.rows[0]) return getLaterForStudent(studentId, existing.rows[0].id);

  const note = (input.note ?? "").trim();
  const problems = noteProblems(note);
  if (problems.length) throw new NowError(400, "invalid_note", problems.join(" "));
  const photos = input.photoKeys ?? [];
  const photoProblem = photoKeysProblem(photos, `origin-now/ask-later/student/${studentId}/`);
  if (photoProblem) throw new NowError(400, "invalid_photos", photoProblem);

  const question = await getOgcodeCatalogQuestionById(input.questionId);
  if (!question) throw new NowError(404, "question_not_found", "Question not found.");
  const subject = String(question.subject ?? "").trim().toLowerCase();
  const difficulty = normalizeDifficulty(question.difficulty);
  if (!isNowSubject(subject) || !difficulty) throw new NowError(400, "question_not_supported", "Help is not available for this question.");
  // Same rule as live help: only after an attempt, so asking is never an answer key.
  if (!isOgcodeProgressAvailable()) throw new NowError(503, "progress_unavailable", "Please try again in a moment.");
  const progress = await getOgcodeQuestionProgress(studentId, input.questionId);
  if (!progress.attempted && progress.totalAttempts === 0 && !progress.answerRevealed) {
    throw new NowError(409, "attempt_first", "Try the question first, then ask for help.");
  }
  if ((await countOpen(studentId)) >= config.maxOpenPerStudent) {
    throw new NowError(429, "too_many_open", `You can have ${config.maxOpenPerStudent} ask-later doubts waiting at a time.`);
  }
  const live = lookupPrice((await loadPriceTable()).rows, difficulty, "human");
  if (!live) throw new NowError(503, "no_price", "Help is not priced yet.");
  const price = askLaterPrice(live.priceCoins, config.pricePercent);

  const id = createPrefixedId("nlat");
  await withNowTransaction(async (client) => {
    await client.query(
      `INSERT INTO now.later_requests (id, student_id, question_id, subject, chapter, difficulty, context_json, note, photo_keys,
                                       price_coins, expires_at, idempotency_key, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, $13)`,
      [
        id,
        studentId,
        input.questionId,
        subject,
        question.chapter ?? null,
        difficulty,
        JSON.stringify({ question: { text: question.text, options: question.options ?? [], image: question.image ?? null } }),
        note || null,
        photos,
        price,
        new Date(now.getTime() + config.answerHours * HOUR),
        idempotencyKey,
        now,
      ],
    );
    // Throws InsufficientCoinsError and rolls the doubt back.
    await postTransfers([sessionHold(studentId, id, price)], { client, now });
    await logEvent(client, { type: "later.posted", requestId: id, actor: studentId, payload: { subject, difficulty, price } });
  });
  return getLaterForStudent(studentId, id);
}

async function loadRow(id: string): Promise<Row | null> {
  return ((await (await db()).query<Row>(`SELECT * FROM now.later_requests WHERE id = $1`, [id])).rows[0] as Row | undefined) ?? null;
}

async function helperName(helperId: string | null): Promise<string | null> {
  if (!helperId) return null;
  const res = await (await db()).query<{ display_name: string | null }>(`SELECT display_name FROM now.helpers WHERE id = $1`, [helperId]);
  return res.rows[0]?.display_name ?? null;
}

export async function getLaterForStudent(studentId: string, id: string): Promise<LaterView> {
  const row = await loadRow(id);
  if (!row || row.student_id !== studentId) throw new NowError(404, "not_found", "Not found.");
  return toView(row, await helperName(row.helper_id), "student");
}

export async function listMyLater(studentId: string): Promise<LaterView[]> {
  const res = await (await db()).query<Row & { helper_name: string | null }>(
    `SELECT r.*, h.display_name AS helper_name FROM now.later_requests r LEFT JOIN now.helpers h ON h.id = r.helper_id
      WHERE r.student_id = $1 ORDER BY r.created_at DESC LIMIT 30`,
    [studentId],
  );
  return res.rows.map((r) => toView(r, r.helper_name, "student"));
}

export async function cancelAskLater(studentId: string, id: string, now: Date = new Date()): Promise<LaterView> {
  await withNowTransaction(async (client) => {
    const row = (await client.query<Row>(`SELECT * FROM now.later_requests WHERE id = $1 FOR UPDATE`, [id])).rows[0];
    if (!row || row.student_id !== studentId) throw new NowError(404, "not_found", "Not found.");
    if (row.status !== "open") throw new NowError(409, "too_late", "A solver is already on it, so it cannot be cancelled.");
    await closeWithRefund(client, row, "cancelled", now);
  });
  return getLaterForStudent(studentId, id);
}

/** Coins back to the student, status to `status`. Inside the caller's transaction. */
async function closeWithRefund(client: Parameters<Parameters<typeof withNowTransaction>[0]>[0], row: Row, status: "cancelled" | "expired", now: Date) {
  await client.query(
    `UPDATE now.later_requests SET status = $2, settled_at = $3, settle_outcome = 'refunded', updated_at = $3 WHERE id = $1`,
    [row.id, status, now],
  );
  await postTransfers(sessionRelease(row.student_id, row.id, row.price_coins), { client, now });
  await logEvent(client, { type: `later.${status}`, requestId: row.id, actor: status === "cancelled" ? row.student_id : "system", payload: {} });
}

/** Pays the solver (price minus commission, pending 24 h) and any tip. Inside the caller's transaction. */
async function payOut(
  client: Parameters<Parameters<typeof withNowTransaction>[0]>[0],
  row: Row,
  input: { stars: number | null; tipCoins: number; actor: string },
  now: Date,
) {
  const helper = (await client.query<{ user_id: string }>(`SELECT user_id FROM now.helpers WHERE id = $1`, [row.helper_id])).rows[0];
  if (!helper) throw new Error("Ask-later doubt without its solver");
  const { commissionBps } = await getNowSettings();
  const transfers: Transfer[] = sessionCapture({
    requestId: row.id,
    heldCoins: row.price_coins,
    solverKind: "human",
    solverUserId: helper.user_id,
    commissionBps,
    endedAt: now,
  });
  if (input.tipCoins > 0) transfers.push(tipTransfer(row.student_id, helper.user_id, row.id, input.tipCoins, now));
  await client.query(
    `UPDATE now.later_requests SET status = 'accepted', stars = $2, tip_coins = $3, settled_at = $4, settle_outcome = 'paid', updated_at = $4
      WHERE id = $1`,
    [row.id, input.stars, input.tipCoins, now],
  );
  await postTransfers(transfers, { client, now });
  await logEvent(client, { type: "later.accepted", requestId: row.id, actor: input.actor, payload: { stars: input.stars, tip: input.tipCoins } });
}

export async function acceptLaterAnswer(
  studentId: string,
  id: string,
  input: { stars: number; tipCoins?: number },
  now: Date = new Date(),
): Promise<LaterView> {
  const { tipCap } = await getNowSettings();
  const tipCoins = input.tipCoins ?? 0;
  if (!Number.isInteger(input.stars) || input.stars < 1 || input.stars > 5) throw new NowError(400, "invalid_stars", "Pick 1 to 5 stars.");
  if (!Number.isInteger(tipCoins) || tipCoins < 0 || tipCoins > tipCap) throw new NowError(400, "invalid_tip", `A tip can be 0 to ${tipCap} coins.`);
  await withNowTransaction(async (client) => {
    const row = (await client.query<Row>(`SELECT * FROM now.later_requests WHERE id = $1 FOR UPDATE`, [id])).rows[0];
    if (!row || row.student_id !== studentId) throw new NowError(404, "not_found", "Not found.");
    if (row.status !== "answered") throw new NowError(409, "invalid_state", "There is no answer waiting for you here.");
    await payOut(client, row, { stars: input.stars, tipCoins, actor: studentId }, now);
  });
  return getLaterForStudent(studentId, id);
}

/** The student reports the answer: a case in the reports queue; the coins wait for it. */
export async function reportLaterAnswer(
  studentId: string,
  id: string,
  input: { reason: ReportReason; details?: string | null },
  now: Date = new Date(),
): Promise<LaterView> {
  if (!REPORT_REASONS.includes(input.reason)) throw new NowError(400, "invalid_reason", "Pick a reason.");
  await withNowTransaction(async (client) => {
    const row = (await client.query<Row>(`SELECT * FROM now.later_requests WHERE id = $1 FOR UPDATE`, [id])).rows[0];
    if (!row || row.student_id !== studentId) throw new NowError(404, "not_found", "Not found.");
    if (row.status !== "answered") throw new NowError(409, "invalid_state", "Only an answer waiting for you can be reported.");
    const helper = (await client.query<{ user_id: string }>(`SELECT user_id FROM now.helpers WHERE id = $1`, [row.helper_id])).rows[0];
    await client.query(`UPDATE now.later_requests SET status = 'disputed', updated_at = $2 WHERE id = $1`, [id, now]);
    await client.query(
      `INSERT INTO now.reports (id, session_id, reporter_id, reported_user_id, reported_helper_id, reporter_role, reason, details, later_request_id, created_at)
       VALUES ($1, NULL, $2, $3, $4, 'student', $5, $6, $7, $8)`,
      [
        createPrefixedId("nrep"),
        studentId,
        helper?.user_id ?? null,
        row.helper_id,
        input.reason,
        `Ask later answer ${id}${input.details?.trim() ? `: ${input.details.trim().slice(0, 900)}` : ""}`,
        id,
        now,
      ],
    );
    await logEvent(client, { type: "later.reported", requestId: id, actor: studentId, payload: { reason: input.reason } });
  });
  return getLaterForStudent(studentId, id);
}

/** Called when an admin closes a report about an ask-later answer: upheld → student refunded, dismissed → solver paid. */
export async function settleDisputedLater(laterId: string, outcome: "upheld" | "dismissed", now: Date = new Date()): Promise<void> {
  await withNowTransaction(async (client) => {
    const row = (await client.query<Row>(`SELECT * FROM now.later_requests WHERE id = $1 FOR UPDATE`, [laterId])).rows[0];
    if (!row || row.status !== "disputed") return;
    if (outcome === "dismissed") {
      await payOut(client, row, { stars: null, tipCoins: 0, actor: "system" }, now);
      return;
    }
    await client.query(
      `UPDATE now.later_requests SET status = 'cancelled', settled_at = $2, settle_outcome = 'refunded', updated_at = $2 WHERE id = $1`,
      [laterId, now],
    );
    await postTransfers(sessionRelease(row.student_id, row.id, row.price_coins), { client, now });
    await logEvent(client, { type: "later.refunded_after_report", requestId: laterId, actor: "system", payload: {} });
  });
}

// ---------------------------------------------------------------------------
// Solver.

async function requireSolver(userId: string) {
  const res = await (await db()).query<{ id: string; verification_status: string }>(
    `SELECT id, verification_status FROM now.helpers WHERE user_id = $1 AND kind = 'human'`,
    [userId],
  );
  const helper = res.rows[0];
  if (!helper) throw new NowError(404, "not_a_solver", "This account is not an Origin NOW solver.");
  if (helper.verification_status !== "verified") throw new NowError(403, "restricted", "Your solver account is on hold.");
  return helper;
}

export type LaterQueue = { mine: LaterView[]; open: LaterView[] };

/** Open doubts in the solver's subjects (oldest first), never their own or across a block, and the ones they hold. */
export async function listLaterQueue(solverUserId: string, now: Date = new Date()): Promise<LaterQueue> {
  await requireAskLater();
  const helper = await requireSolver(solverUserId);
  const pool = await db();
  const [open, mine] = await Promise.all([
    pool.query<Row & { student_name: string | null }>(
      `SELECT r.*, u.name AS student_name FROM now.later_requests r JOIN origin_users u ON u.id = r.student_id
        WHERE r.status = 'open' AND r.expires_at > $2 AND r.student_id <> $1
          AND r.subject IN (SELECT subject FROM now.helper_expertise WHERE helper_id = $3)
          AND NOT EXISTS (SELECT 1 FROM now.blocks b WHERE (b.blocker_id = r.student_id AND b.blocked_id = $1)
                                                       OR (b.blocker_id = $1 AND b.blocked_id = r.student_id))
        ORDER BY r.created_at LIMIT 30`,
      [solverUserId, now, helper.id],
    ),
    pool.query<Row & { student_name: string | null }>(
      `SELECT r.*, u.name AS student_name FROM now.later_requests r JOIN origin_users u ON u.id = r.student_id
        WHERE r.helper_id = $1 AND r.status IN ('claimed', 'answered', 'disputed', 'accepted')
        ORDER BY r.updated_at DESC LIMIT 20`,
      [helper.id],
    ),
  ]);
  return {
    open: open.rows.map((r) => ({ ...toView(r, firstNameOnly(r.student_name), "solver"), photos: [] })),
    mine: mine.rows.map((r) => toView(r, firstNameOnly(r.student_name), "solver")),
  };
}

/** Claims an open doubt for `claimMinutes`; a solver holds one claim at a time. */
export async function claimLater(solverUserId: string, id: string, now: Date = new Date()): Promise<LaterView> {
  const { askLater } = await requireAskLater();
  const helper = await requireSolver(solverUserId);
  await withNowTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`now-later-claim:${helper.id}`]);
    const held = await client.query(`SELECT 1 FROM now.later_requests WHERE helper_id = $1 AND status = 'claimed' LIMIT 1`, [helper.id]);
    if (held.rows.length) throw new NowError(409, "one_at_a_time", "Answer or release the doubt you hold first.");
    const row = (await client.query<Row>(`SELECT * FROM now.later_requests WHERE id = $1 FOR UPDATE`, [id])).rows[0];
    if (!row || row.student_id === solverUserId) throw new NowError(404, "not_found", "Not found.");
    if (row.status !== "open" || row.expires_at.getTime() <= now.getTime()) throw new NowError(409, "already_taken", "Someone else took this one.");
    const covers = await client.query(`SELECT 1 FROM now.helper_expertise WHERE helper_id = $1 AND subject = $2 LIMIT 1`, [helper.id, row.subject]);
    if (!covers.rows.length) throw new NowError(403, "not_your_subject", "This doubt is not in your subjects.");
    const claimEnds = new Date(Math.min(now.getTime() + askLater.claimMinutes * 60_000, row.expires_at.getTime()));
    await client.query(
      `UPDATE now.later_requests SET status = 'claimed', helper_id = $2, claimed_at = $3, claim_expires_at = $4, updated_at = $3 WHERE id = $1`,
      [id, helper.id, now, claimEnds],
    );
    await logEvent(client, { type: "later.claimed", requestId: id, actor: solverUserId, payload: { helperId: helper.id } });
  });
  return getLaterForSolver(solverUserId, id);
}

export async function releaseLaterClaim(solverUserId: string, id: string, now: Date = new Date()): Promise<void> {
  const helper = await requireSolver(solverUserId);
  await (await db()).query(
    `UPDATE now.later_requests SET status = 'open', helper_id = NULL, claimed_at = NULL, claim_expires_at = NULL, updated_at = $3
      WHERE id = $1 AND helper_id = $2 AND status = 'claimed'`,
    [id, helper.id, now],
  );
}

export async function getLaterForSolver(solverUserId: string, id: string): Promise<LaterView> {
  const helper = await requireSolver(solverUserId);
  const res = await (await db()).query<Row & { student_name: string | null }>(
    `SELECT r.*, u.name AS student_name FROM now.later_requests r JOIN origin_users u ON u.id = r.student_id WHERE r.id = $1`,
    [id],
  );
  const row = res.rows[0];
  if (!row || row.helper_id !== helper.id) throw new NowError(404, "not_found", "Claim this doubt first.");
  return toView(row, firstNameOnly(row.student_name), "solver");
}

export async function answerLater(
  solverUserId: string,
  id: string,
  input: { text: string; photoKeys?: string[] },
  now: Date = new Date(),
): Promise<LaterView> {
  await requireAskLater();
  const helper = await requireSolver(solverUserId);
  const problems = answerProblems(input.text);
  if (problems.length) throw new NowError(400, "invalid_answer", problems.join(" "));
  const photos = input.photoKeys ?? [];
  const photoProblem = photoKeysProblem(photos, `origin-now/ask-later/answer/${id}/`);
  if (photoProblem) throw new NowError(400, "invalid_photos", photoProblem);
  let studentId = "";
  await withNowTransaction(async (client) => {
    const row = (await client.query<Row>(`SELECT * FROM now.later_requests WHERE id = $1 FOR UPDATE`, [id])).rows[0];
    if (!row || row.helper_id !== helper.id) throw new NowError(404, "not_found", "Claim this doubt first.");
    if (row.status !== "claimed") throw new NowError(409, "invalid_state", "This doubt is not waiting for your answer.");
    if (row.claim_expires_at && row.claim_expires_at.getTime() < now.getTime() - 60_000) {
      throw new NowError(409, "claim_expired", "Your claim ran out and the doubt went back to the queue.");
    }
    studentId = row.student_id;
    await client.query(
      `UPDATE now.later_requests SET status = 'answered', answer_text = $2, answer_photo_keys = $3, answered_at = $4, updated_at = $4 WHERE id = $1`,
      [id, input.text.trim(), photos, now],
    );
    await logEvent(client, { type: "later.answered", requestId: id, actor: solverUserId, payload: { photos: photos.length } });
  });
  await emailAnswerReady(studentId).catch(() => undefined);
  return getLaterForSolver(solverUserId, id);
}

async function emailAnswerReady(studentId: string): Promise<void> {
  const res = await (await db()).query<{ email: string | null; name: string | null }>(`SELECT email, name FROM origin_users WHERE id = $1`, [studentId]);
  const to = res.rows[0]?.email;
  if (!to) return;
  const text = `Hi ${firstNameOnly(res.rows[0]?.name ?? null)}, your doubt has an answer. Open Origin NOW → My doubts to read it, then rate it or report it.`;
  await sendEmail({
    to,
    subject: "Your doubt has an answer",
    text,
    html: renderEmail({
      preheader: "A solver answered your doubt.",
      documentTitle: "Origin - Your answer",
      mascot: "happy",
      title: "Your doubt has",
      titleAccent: "an answer",
      blocks: [paragraph("Open Origin NOW → My doubts to read it, then rate it or report it.", { align: "center" })],
      cta: { label: "Read the answer", href: "/now/later" },
      footerNote: "You received this because you asked a doubt on Origin NOW.",
    }),
  });
}

// ---------------------------------------------------------------------------
// Sweep and admin.

/** Expired claims back to the queue; unanswered doubts refunded; untouched answers accepted. */
export async function runAskLaterSweep(now: Date = new Date()): Promise<{ claimsReleased: number; expired: number; autoAccepted: number }> {
  const pool = await db();
  const { askLater } = await getNowSettings();
  const released = await pool.query(
    `UPDATE now.later_requests SET status = 'open', helper_id = NULL, claimed_at = NULL, claim_expires_at = NULL, updated_at = $1
      WHERE status = 'claimed' AND claim_expires_at <= $1 AND expires_at > $1`,
    [now],
  );
  let expired = 0;
  const due = await pool.query<{ id: string }>(
    `SELECT id FROM now.later_requests WHERE status IN ('open', 'claimed') AND expires_at <= $1 ORDER BY expires_at LIMIT 50`,
    [now],
  );
  for (const { id } of due.rows) {
    await withNowTransaction(async (client) => {
      const row = (await client.query<Row>(`SELECT * FROM now.later_requests WHERE id = $1 FOR UPDATE`, [id])).rows[0];
      if (!row || !["open", "claimed"].includes(row.status)) return;
      await closeWithRefund(client, row, "expired", now);
      expired += 1;
    }).catch((error) => console.error("[origin-now] ask-later expiry failed", id, error instanceof Error ? error.message : error));
  }
  let autoAccepted = 0;
  const stale = await pool.query<{ id: string }>(
    `SELECT id FROM now.later_requests WHERE status = 'answered' AND answered_at <= $1 ORDER BY answered_at LIMIT 50`,
    [new Date(now.getTime() - askLater.autoAcceptHours * HOUR)],
  );
  for (const { id } of stale.rows) {
    await withNowTransaction(async (client) => {
      const row = (await client.query<Row>(`SELECT * FROM now.later_requests WHERE id = $1 FOR UPDATE`, [id])).rows[0];
      if (!row || row.status !== "answered") return;
      await payOut(client, row, { stars: null, tipCoins: 0, actor: "system" }, now);
      autoAccepted += 1;
    }).catch((error) => console.error("[origin-now] ask-later auto-accept failed", id, error instanceof Error ? error.message : error));
  }
  return { claimsReleased: released.rowCount ?? 0, expired, autoAccepted };
}

export type LaterAdminRow = LaterView & { studentName: string | null; solverName: string | null; settleOutcome: string | null };

export async function listLaterForAdmin(status: AskLaterStatus | null = null): Promise<LaterAdminRow[]> {
  const res = await (await db()).query<Row & { student_name: string | null; helper_name: string | null }>(
    `SELECT r.*, u.name AS student_name, h.display_name AS helper_name
       FROM now.later_requests r JOIN origin_users u ON u.id = r.student_id LEFT JOIN now.helpers h ON h.id = r.helper_id
      WHERE $1::text IS NULL OR r.status = $1
      ORDER BY r.created_at DESC LIMIT 200`,
    [status],
  );
  return res.rows.map((r) => ({
    ...toView(r, r.helper_name, "admin"),
    studentName: r.student_name,
    solverName: r.helper_name,
    settleOutcome: r.settle_outcome,
  }));
}
