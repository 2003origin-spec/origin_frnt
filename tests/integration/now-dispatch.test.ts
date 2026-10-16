/**
 * Origin NOW requests, matching and the session state machine against a real
 * Postgres: request → offer → accept → join → extend → end → settle, the
 * accept race, decline/expiry re-dispatch, bot fallback, both no-show paths,
 * cancel, and the sweep / nightly backstops. Every test ends with the ledger
 * balanced and the student's coins where the rules say they must be.
 *
 * Skipped when USER_DATABASE_URL isn't configured (plain CI). Presence uses
 * the in-memory fallback and QStash is unset, so timers are driven by calling
 * the handlers with an explicit `now`, exactly as the sweep would.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { findUnbalancedTransfers, PLATFORM_ACCOUNTS } from "@/server/now/ledger-rules";
import { getWalletBalance, loadAllLegsForAudit } from "@/server/now/ledger-store";
import {
  cancelRequest,
  createRequest,
  expireOffer,
  getCurrentOffer,
  getRequestView,
  heartbeatHelper,
  goOffline,
  respondToOffer,
} from "@/server/now/dispatch-service";
import { clearPresence } from "@/server/now/now-realtime";
import { ensureNowSchema } from "@/server/now/now-schema";
import {
  confirmExtension,
  endSession,
  handleNoShow,
  joinSession,
  recordOutcome,
  requestExtension,
  runNowNightly,
  runNowSweep,
} from "@/server/now/session-service";
import { NO_SHOW_WINDOW_MS, OFFER_WINDOW_MS } from "@/server/now/types";
import { getOgcodeCatalogCounts } from "@/server/ogcode-catalog";
import { getOgcodeQuestionProgress } from "@/server/ogcode-progress";
import { setSetting } from "@/server/platform-settings";

import { closePool, dbConfigured, makeId, rawPool } from "./_db";

const SKIP = !dbConfigured() || !process.env.OGCODE_DATABASE_URL;
const WELCOME = 200;
const EASY_HUMAN = 40; // DEFAULT_PRICE_TABLE placeholders
const EASY_EXTENSION = 20;

const helpersMade: string[] = [];
const questionsMade: string[] = [];

async function setup(): Promise<void> {
  await ensureNowSchema();
  await setSetting("now_welcome_coins", String(WELCOME), null);
  await setSetting("now_commission_bps", "0", null);
  await setSetting("now_open_hours", JSON.stringify({ from: "00:00", to: "23:59", days: [0, 1, 2, 3, 4, 5, 6] }), null);
  await setSetting(
    "now_bot_rule",
    JSON.stringify({ enabled: true, whenNoneOnline: true, afterFailedOffers: 3, afterMs: 120_000 }),
    null,
  );
  await rawPool().query(`DELETE FROM now.prices`);
}

async function seedUser(name: string): Promise<string> {
  const id = makeId("now_user");
  await rawPool().query(
    `INSERT INTO origin_users (id, name, email, role, password_hash, date_of_birth) VALUES ($1, $2, $3, 'student', 'x', '1995-01-01')`,
    [id, name, `${id}@example.com`],
  );
  return id;
}

async function seedStudent(): Promise<string> {
  const id = await seedUser("Meera Iyer");
  await rawPool().query(`INSERT INTO now.pilot_cohort (user_id, invited_by) VALUES ($1, NULL)`, [id]);
  return id;
}

async function seedHelper(subject: string): Promise<{ userId: string; helperId: string }> {
  const userId = await seedUser("Ravi Teacher");
  const helperId = makeId("helper");
  await rawPool().query(
    `INSERT INTO now.helpers (id, user_id, kind, role, display_name, verification_status, languages, agreement_version, agreement_accepted_at)
     VALUES ($1, $2, 'human', 'teacher', 'Ravi', 'verified', '{english}', '2026-10-draft', NOW())`,
    [helperId, userId],
  );
  await rawPool().query(`INSERT INTO now.helper_expertise (helper_id, subject, chapter) VALUES ($1, $2, '')`, [helperId, subject]);
  helpersMade.push(helperId);
  return { userId, helperId };
}

async function seedAttemptedQuestion(studentId: string, subject: string): Promise<string> {
  await getOgcodeCatalogCounts(); // creates ogcode_questions on a fresh database
  await getOgcodeQuestionProgress(studentId, "warmup"); // creates ogcode_question_progress
  const id = makeId("q");
  questionsMade.push(id);
  await rawPool().query(
    `INSERT INTO ogcode_questions (id, source_index, text, options, correct_option, explanation, subject, chapter, concept, difficulty, question_type)
     VALUES ($1, $2, 'A ball is thrown up at 10 m/s. Max height?', $3::jsonb, 1, 'v^2/2g', $4, 'Kinematics', 'Projectile', 'Easy', 'mcq')`,
    [id, 800_000 + Math.floor(Math.random() * 90_000), JSON.stringify(["2 m", "5 m", "10 m", "20 m"]), subject],
  );
  await rawPool().query(
    `INSERT INTO ogcode_question_progress (user_id, question_id, total_attempts, attempted) VALUES ($1, $2, 1, TRUE)`,
    [studentId, id],
  );
  return id;
}

async function status(requestId: string): Promise<string> {
  const res = await rawPool().query<{ status: string }>(`SELECT status FROM now.requests WHERE id = $1`, [requestId]);
  return res.rows[0].status;
}

async function sessionOf(requestId: string) {
  const res = await rawPool().query(`SELECT * FROM now.sessions WHERE request_id = $1 ORDER BY accepted_at DESC LIMIT 1`, [requestId]);
  return res.rows[0];
}

async function accountBalance(account: string): Promise<number> {
  const res = await rawPool().query<{ n: number }>(
    `SELECT COALESCE(sum(CASE WHEN direction = 'credit' THEN amount ELSE -amount END), 0)::int AS n
       FROM now.ledger_entries WHERE account_id = $1`,
    [account],
  );
  return res.rows[0].n;
}

async function assertLedgerBalanced(): Promise<void> {
  assert.deepEqual(findUnbalancedTransfers(await loadAllLegsForAudit()), []);
}

test.after(async () => {
  for (const id of helpersMade) await clearPresence(id);
  // Other suites sample the question bank (the solver quiz); leave it as found.
  if (dbConfigured() && questionsMade.length) {
    await rawPool().query(`DELETE FROM ogcode_question_progress WHERE question_id = ANY($1::text[])`, [questionsMade]);
    await rawPool().query(`DELETE FROM ogcode_questions WHERE id = ANY($1::text[])`, [questionsMade]);
  }
  await closePool();
});

test("human flow: offer → accept → join → extend → end with outcome → solver paid (pending)", { skip: SKIP }, async () => {
  await setup();
  const student = await seedStudent();
  const solver = await seedHelper("physics");
  await heartbeatHelper(solver.userId, null);
  const questionId = await seedAttemptedQuestion(student, "physics");

  const created = await createRequest(student, { questionId, language: "english" });
  assert.equal(created.status, "offered");
  assert.equal(created.heldCoins, EASY_HUMAN);
  assert.equal((await getWalletBalance(student)).available, WELCOME - EASY_HUMAN);

  // The solver sees the offer card (question, no student identity).
  const offer = await getCurrentOffer(solver.userId);
  assert.ok(offer);
  assert.match(offer.card.question.text, /ball is thrown/);
  assert.equal(offer.card.priceCoins, EASY_HUMAN);

  const accepted = await respondToOffer(solver.userId, offer.offerId, "accept", null);
  assert.equal(accepted.accepted, true);
  assert.equal(await status(created.id), "accepted");

  // Solver view: first name only.
  const solverView = await getRequestView(created.id, { viewerUserId: solver.userId });
  assert.equal(solverView.studentFirstName, "Meera");

  const sessionId = accepted.sessionId!;
  assert.equal((await joinSession(student, sessionId)).live, false);
  assert.equal((await joinSession(solver.userId, sessionId)).live, true);
  assert.equal(await status(created.id), "live");
  const live = await sessionOf(created.id);
  assert.equal(new Date(live.ends_at).getTime() - new Date(live.started_at).getTime(), 4 * 60_000);

  // Only the solver can confirm; the student pays.
  assert.equal((await requestExtension(student, sessionId)).pending, true);
  await assert.rejects(confirmExtension({ helperUserId: student }, sessionId), /Session not found|Only the solver/);
  await confirmExtension({ helperUserId: solver.userId }, sessionId);
  const extended = await sessionOf(created.id);
  assert.equal(extended.extensions_used, 1);
  assert.equal(new Date(extended.ends_at).getTime() - new Date(live.ends_at).getTime(), 2 * 60_000);
  assert.equal((await getWalletBalance(student)).available, WELCOME - EASY_HUMAN - EASY_EXTENSION);

  await endSession({ userId: solver.userId }, sessionId, { outcome: "resolved", rootCause: "conceptual_gap" });
  const ended = await sessionOf(created.id);
  assert.equal(ended.payable, true);
  assert.ok(ended.settled_at);
  assert.equal(await status(created.id), "ended");

  // Coins: student keeps the rest; the solver's earnings are pending for 24 h.
  assert.equal((await getWalletBalance(student)).available, WELCOME - EASY_HUMAN - EASY_EXTENSION);
  const solverWallet = await getWalletBalance(solver.userId);
  assert.equal(solverWallet.available, 0);
  assert.equal(solverWallet.pending, EASY_HUMAN + EASY_EXTENSION);
  const heldLeft = await rawPool().query(`SELECT held_coins FROM now.requests WHERE id = $1`, [created.id]);
  assert.equal(heldLeft.rows[0].held_coins, 0);

  // Ending twice, or a late outcome, changes nothing.
  await endSession({ userId: student }, sessionId);
  await assert.rejects(recordOutcome(solver.userId, sessionId, "partial", null), /closed/);
  await goOffline(solver.userId);
  await assertLedgerBalanced();
});

test("accept race: exactly one of two simultaneous accepts wins", { skip: SKIP }, async () => {
  await setup();
  const student = await seedStudent();
  const solver = await seedHelper("physics");
  await heartbeatHelper(solver.userId, null);
  const created = await createRequest(student, { questionId: await seedAttemptedQuestion(student, "physics") });
  assert.equal(created.status, "offered");
  const offer = (await getCurrentOffer(solver.userId))!;

  const results = await Promise.allSettled([
    respondToOffer(solver.userId, offer.offerId, "accept", null),
    respondToOffer(solver.userId, offer.offerId, "accept", null),
    respondToOffer(solver.userId, offer.offerId, "accept", null),
  ]);
  const won = results.filter((r) => r.status === "fulfilled" && r.value.accepted);
  const lost = results.filter((r) => r.status === "rejected");
  assert.equal(won.length, 1);
  assert.equal(lost.length, 2);
  for (const r of lost) assert.match(String((r as PromiseRejectedResult).reason), /already taken/);
  const sessions = await rawPool().query(`SELECT count(*)::int AS n FROM now.sessions WHERE request_id = $1`, [created.id]);
  assert.equal(sessions.rows[0].n, 1);

  await cancelRequest(student, created.id);
  assert.equal((await getWalletBalance(student)).available, WELCOME);
  await goOffline(solver.userId);
  await assertLedgerBalanced();
});

test("decline and expiry move the request to the next solver; a stale accept is refused", { skip: SKIP }, async () => {
  await setup();
  const student = await seedStudent();
  const first = await seedHelper("physics");
  const second = await seedHelper("physics");
  const third = await seedHelper("physics");
  for (const h of [first, second, third]) await heartbeatHelper(h.userId, null);
  const created = await createRequest(student, { questionId: await seedAttemptedQuestion(student, "physics") });

  const offers = await rawPool().query<{ helper_id: string; id: string }>(
    `SELECT helper_id, id FROM now.offers WHERE request_id = $1`,
    [created.id],
  );
  assert.equal(offers.rows.length, 1);
  const firstOffered = [first, second, third].find((h) => h.helperId === offers.rows[0].helper_id)!;
  await respondToOffer(firstOffered.userId, offers.rows[0].id, "decline", "busy");

  // Re-dispatched to someone else straight away.
  const secondOfferRow = await rawPool().query<{ helper_id: string; id: string; expires_at: Date }>(
    `SELECT helper_id, id, expires_at FROM now.offers WHERE request_id = $1 AND response IS NULL`,
    [created.id],
  );
  assert.equal(secondOfferRow.rows.length, 1);
  assert.notEqual(secondOfferRow.rows[0].helper_id, firstOffered.helperId);
  await assert.rejects(respondToOffer(firstOffered.userId, offers.rows[0].id, "accept", null), /already taken|expired/);

  // An offer is not expired early, then expires and moves on again.
  assert.equal(await expireOffer(secondOfferRow.rows[0].id), false);
  const later = new Date(secondOfferRow.rows[0].expires_at.getTime() + 1_000);
  assert.equal(await expireOffer(secondOfferRow.rows[0].id, later), true);
  const third_ = await rawPool().query<{ helper_id: string }>(
    `SELECT helper_id FROM now.offers WHERE request_id = $1 AND response IS NULL`,
    [created.id],
  );
  assert.equal(third_.rows.length, 1);
  const offeredSoFar = await rawPool().query<{ n: number }>(
    `SELECT count(DISTINCT helper_id)::int AS n FROM now.offers WHERE request_id = $1`,
    [created.id],
  );
  assert.equal(offeredSoFar.rows[0].n, 3, "nobody is offered the same request twice");
  const failed = await rawPool().query(`SELECT failed_offers FROM now.requests WHERE id = $1`, [created.id]);
  assert.equal(failed.rows[0].failed_offers, 2);

  await cancelRequest(student, created.id);
  for (const h of [first, second, third]) await goOffline(h.userId);
  assert.equal((await getWalletBalance(student)).available, WELCOME);
  await assertLedgerBalanced();
});

test("bot fallback: nobody online → Origin bot at the bot price; bot sessions settle at end", { skip: SKIP }, async () => {
  await setup();
  const student = await seedStudent();
  const created = await createRequest(student, { questionId: await seedAttemptedQuestion(student, "chemistry") });
  assert.equal(created.status, "accepted");
  assert.equal(created.session?.solverKind, "bot");
  assert.equal(created.session?.solverJoined, true);
  const botBefore = await accountBalance(PLATFORM_ACCOUNTS.botRevenue);

  const sessionId = created.session!.id;
  assert.equal((await joinSession(student, sessionId)).live, true);
  // A bot confirms more time by itself.
  const ext = await requestExtension(student, sessionId);
  assert.equal(ext.pending, false);
  await endSession({ userId: student }, sessionId);

  const session = await sessionOf(created.id);
  assert.equal(session.payable, true);
  assert.equal(await accountBalance(PLATFORM_ACCOUNTS.botRevenue), botBefore + EASY_HUMAN + EASY_EXTENSION);
  assert.equal((await getWalletBalance(student)).available, WELCOME - EASY_HUMAN - EASY_EXTENSION);
  await assertLedgerBalanced();
});

test("helper no-show sends the request back without them; student no-show closes and refunds", { skip: SKIP }, async () => {
  await setup();
  // Helper no-show.
  const student = await seedStudent();
  const solver = await seedHelper("physics");
  await heartbeatHelper(solver.userId, null);
  const created = await createRequest(student, { questionId: await seedAttemptedQuestion(student, "physics") });
  const offer = (await getCurrentOffer(solver.userId))!;
  const { sessionId } = await respondToOffer(solver.userId, offer.offerId, "accept", null);
  await joinSession(student, sessionId!);
  assert.equal(await handleNoShow(sessionId!), null, "not before the join window");
  const late = new Date(Date.now() + NO_SHOW_WINDOW_MS + 1_000);
  await heartbeatHelper(solver.userId, null, late); // still "online", but excluded for this request
  assert.equal(await handleNoShow(sessionId!, late), "helper");
  const after = await rawPool().query(`SELECT status, excluded_helper_ids, helper_id, held_coins FROM now.requests WHERE id = $1`, [
    created.id,
  ]);
  assert.ok(after.rows[0].excluded_helper_ids.includes(solver.helperId));
  // Waited past the bot's afterMs, so the bot took over; the solver was never re-offered.
  assert.equal(after.rows[0].status, "accepted");
  assert.notEqual(after.rows[0].helper_id, solver.helperId);
  const reoffers = await rawPool().query(`SELECT count(*)::int AS n FROM now.offers WHERE request_id = $1`, [created.id]);
  assert.equal(reoffers.rows[0].n, 1);
  await cancelRequest(student, created.id);
  assert.equal((await getWalletBalance(student)).available, WELCOME);
  await goOffline(solver.userId);

  // Student no-show.
  const student2 = await seedStudent();
  const solver2 = await seedHelper("physics");
  await heartbeatHelper(solver2.userId, null);
  const created2 = await createRequest(student2, { questionId: await seedAttemptedQuestion(student2, "physics") });
  const offer2 = (await getCurrentOffer(solver2.userId))!;
  const accepted2 = await respondToOffer(solver2.userId, offer2.offerId, "accept", null);
  await joinSession(solver2.userId, accepted2.sessionId!);
  assert.equal(await handleNoShow(accepted2.sessionId!, new Date(Date.now() + NO_SHOW_WINDOW_MS + 1_000)), "student");
  assert.equal(await status(created2.id), "no_show");
  assert.equal((await getWalletBalance(student2)).available, WELCOME);
  assert.equal((await getWalletBalance(solver2.userId)).pending, 0);
  await goOffline(solver2.userId);
  await assertLedgerBalanced();
});

test("the sweep and the nightly job finish what missed timers left", { skip: SKIP }, async () => {
  await setup();
  const student = await seedStudent();
  const solver = await seedHelper("physics");
  await heartbeatHelper(solver.userId, null);
  const created = await createRequest(student, { questionId: await seedAttemptedQuestion(student, "physics") });
  const offer = (await getCurrentOffer(solver.userId))!;
  const { sessionId } = await respondToOffer(solver.userId, offer.offerId, "accept", null);
  await joinSession(student, sessionId!);
  await joinSession(solver.userId, sessionId!);

  // Session overran its end with no timer: the sweep ends it. No outcome yet → not settled.
  const pastEnd = new Date(Date.now() + 5 * 60_000);
  const swept = await runNowSweep(pastEnd);
  assert.ok(swept.ended >= 1);
  const ended = await sessionOf(created.id);
  assert.equal(ended.ended_by, "timer");
  assert.equal(ended.settled_at, null);

  // The solver reports the outcome → settles payable.
  await recordOutcome(solver.userId, sessionId!, "partial", "calculation_error");
  assert.equal((await sessionOf(created.id)).payable, true);

  // A day later the nightly closes the rating window.
  const nightly = await runNowNightly(new Date(Date.now() + 25 * 60 * 60_000));
  assert.ok(nightly.ratingWindowsClosed >= 1);
  assert.equal(nightly.unbalancedTransfers, 0);
  assert.equal(await status(created.id), "unrated");

  // Offer window constant is what the offers carry.
  const anyOffer = await rawPool().query<{ offered_at: Date; expires_at: Date }>(
    `SELECT offered_at, expires_at FROM now.offers WHERE request_id = $1`,
    [created.id],
  );
  assert.equal(anyOffer.rows[0].expires_at.getTime() - anyOffer.rows[0].offered_at.getTime(), OFFER_WINDOW_MS);
  await goOffline(solver.userId);
  await assertLedgerBalanced();
});

test("guards: attempt first, one open request, cancel refunds", { skip: SKIP }, async () => {
  await setup();
  const student = await seedStudent();
  await getOgcodeCatalogCounts();
  const unattempted = makeId("q");
  questionsMade.push(unattempted);
  await rawPool().query(
    `INSERT INTO ogcode_questions (id, source_index, text, options, correct_option, explanation, subject, chapter, concept, difficulty, question_type)
     VALUES ($1, $2, 'Unattempted', $3::jsonb, 0, 'x', 'physics', 'Kinematics', 'Velocity', 'Easy', 'mcq')`,
    [unattempted, 700_000 + Math.floor(Math.random() * 90_000), JSON.stringify(["A", "B"])],
  );
  await assert.rejects(createRequest(student, { questionId: unattempted }), /Try the question first/);

  const solver = await seedHelper("physics");
  await heartbeatHelper(solver.userId, null);
  const first = await createRequest(student, { questionId: await seedAttemptedQuestion(student, "physics") });
  await assert.rejects(
    createRequest(student, { questionId: await seedAttemptedQuestion(student, "physics") }),
    /already have a live help request/,
  );
  // The failed second request held nothing.
  assert.equal((await getWalletBalance(student)).available, WELCOME - EASY_HUMAN);
  const cancelled = await cancelRequest(student, first.id);
  assert.equal(cancelled.status, "cancelled");
  assert.equal((await getWalletBalance(student)).available, WELCOME);
  // The offered solver's offer is closed.
  assert.equal(await getCurrentOffer(solver.userId), null);
  // A stranger cannot see the request.
  const stranger = await seedUser("Someone Else");
  await assert.rejects(getRequestView(first.id, { viewerUserId: stranger }), /not found/i);
  await goOffline(solver.userId);
  await assertLedgerBalanced();
});
