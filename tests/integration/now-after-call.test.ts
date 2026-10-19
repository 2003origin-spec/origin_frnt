/**
 * After the call, against a real Postgres: rating + tip (pending for the
 * solver, to bot revenue for the bot), once and only inside the window;
 * practice questions on the same concept; reports from either side with the
 * held-rating rule, wallet freeze and the strike rules; automatic review;
 * two-way blocks in matching; admin reinstate / lift.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  getAfterCall,
  rateSession,
  recordPracticeAttempt,
  reinstateHelper,
  reportSession,
  resolveReport,
  liftSuspension,
} from "@/server/now/after-call-service";
import { createRequest, getCurrentOffer, heartbeatHelper, respondToOffer } from "@/server/now/dispatch-service";
import { PLATFORM_ACCOUNTS } from "@/server/now/ledger-rules";
import { getWalletBalance } from "@/server/now/ledger-store";
import { clearPresence } from "@/server/now/now-realtime";
import { endSession, joinSession } from "@/server/now/session-service";
import { getOgcodeCatalogCounts } from "@/server/ogcode-catalog";
import { RATING_WINDOW_MS } from "@/server/now/types";

import { closePool, makeId, rawPool } from "./_db";
import {
  EASY_HUMAN,
  NOW_SKIP,
  WELCOME,
  accountBalance,
  assertLedgerBalanced,
  cleanupNowFixtures,
  helpersMade,
  questionsMade,
  seedAttemptedQuestion,
  seedHelper,
  seedStudent,
  seedUser,
  setup,
  status,
} from "./_now";

test.after(async () => {
  await cleanupNowFixtures();
  await closePool();
});

async function offlineEveryone() {
  for (const id of helpersMade) await clearPresence(id);
}

/** A finished human call: request → accept → both join → solver ends with an outcome. */
async function finishedHumanCall(opts: { student?: string; solver?: { userId: string; helperId: string }; end?: boolean } = {}) {
  await setup();
  await offlineEveryone();
  const student = opts.student ?? (await seedStudent());
  const solver = opts.solver ?? (await seedHelper("physics"));
  await heartbeatHelper(solver.userId, null);
  const request = await createRequest(student, { questionId: await seedAttemptedQuestion(student, "physics") });
  const offer = await getCurrentOffer(solver.userId);
  assert.ok(offer, "the solver got the offer");
  const { sessionId } = await respondToOffer(solver.userId, offer.offerId, "accept", null);
  await joinSession(student, sessionId!);
  await joinSession(solver.userId, sessionId!);
  if (opts.end !== false) await endSession({ userId: solver.userId }, sessionId!, { outcome: "resolved", rootCause: "conceptual_gap" });
  return { student, solver, requestId: request.id, sessionId: sessionId! };
}

async function seedPracticePool(count: number) {
  await getOgcodeCatalogCounts();
  for (let i = 0; i < count; i++) {
    const id = makeId("qp");
    questionsMade.push(id);
    await rawPool().query(
      `INSERT INTO ogcode_questions (id, source_index, text, options, correct_option, explanation, subject, chapter, concept, difficulty, question_type)
       VALUES ($1, $2, $3, $4::jsonb, 0, 'x', 'physics', 'Kinematics', 'Projectile', 'Medium', 'mcq')`,
      [id, 500_000 + Math.floor(Math.random() * 90_000), `Projectile practice ${i}`, JSON.stringify(["A", "B", "C", "D"])],
    );
  }
}

test("rating + tip: once, inside the window; the tip is pending for the solver; practice is offered", { skip: NOW_SKIP }, async () => {
  await seedPracticePool(5);
  const { student, solver, requestId, sessionId } = await finishedHumanCall();

  const [before, twin] = await Promise.all([getAfterCall(student, sessionId), getAfterCall(student, sessionId)]);
  assert.deepEqual(twin.practice, before.practice, "two simultaneous first loads agree");
  const offeredCount = await rawPool().query(`SELECT count(*)::int AS n FROM now.events WHERE session_id = $1 AND type = 'practice.offered'`, [
    sessionId,
  ]);
  assert.equal(offeredCount.rows[0].n, 1);
  assert.equal(before.canRate, true);
  assert.equal(before.practice.length, 3);
  const again = await getAfterCall(student, sessionId);
  assert.deepEqual(again.practice, before.practice, "the same three every time");
  for (const q of before.practice) {
    const row = await rawPool().query(`SELECT concept FROM ogcode_questions WHERE id = $1`, [q]);
    assert.equal(row.rows[0].concept, "Projectile");
  }

  await assert.rejects(rateSession(student, sessionId, { stars: 5, tags: [], comment: null, tipCoins: 51 }), /at most 50/);
  const rated = await rateSession(student, sessionId, { stars: 5, tags: ["clear_explanation"], comment: "Thanks!", tipCoins: 20 });
  assert.equal(rated.canRate, false);
  assert.equal(rated.rating?.tipCoins, 20);
  assert.equal(await status(requestId), "rated");
  await assert.rejects(rateSession(student, sessionId, { stars: 4, tags: [], comment: null, tipCoins: 0 }), /already rated/);

  assert.equal((await getWalletBalance(student)).available, WELCOME - EASY_HUMAN - 20);
  assert.equal((await getWalletBalance(solver.userId)).pending, EASY_HUMAN + 20, "session coins + tip wait out the rating window");

  await recordPracticeAttempt(student, sessionId, before.practice[0]);
  await recordPracticeAttempt(student, sessionId, before.practice[0]);
  const attempts = await rawPool().query(`SELECT count(*)::int AS n FROM now.events WHERE session_id = $1 AND type = 'practice.attempted'`, [
    sessionId,
  ]);
  assert.equal(attempts.rows[0].n, 1);
  await assert.rejects(recordPracticeAttempt(student, sessionId, "q_not_offered"), /not part of this practice set/);

  // A solver sees neither the rating form nor practice; the window closes after 24 h.
  const solverView = await getAfterCall(solver.userId, sessionId);
  assert.equal(solverView.canRate, false);
  assert.deepEqual(solverView.practice, []);
  const late = await finishedHumanCall();
  await assert.rejects(
    rateSession(late.student, late.sessionId, { stars: 3, tags: [], comment: null, tipCoins: 0 }, new Date(Date.now() + RATING_WINDOW_MS + 60_000)),
    /window/,
  );
  await assertLedgerBalanced();
});

test("tipping the Origin bot goes to bot revenue", { skip: NOW_SKIP }, async () => {
  await setup();
  await offlineEveryone();
  const student = await seedStudent();
  const request = await createRequest(student, { questionId: await seedAttemptedQuestion(student, "chemistry") });
  const sessionId = request.session!.id;
  await joinSession(student, sessionId);
  await endSession({ userId: student }, sessionId);
  const bot = await accountBalance(PLATFORM_ACCOUNTS.botRevenue);
  await rateSession(student, sessionId, { stars: 4, tags: [], comment: null, tipCoins: 5 });
  assert.equal(await accountBalance(PLATFORM_ACCOUNTS.botRevenue), bot + 5);
  await assertLedgerBalanced();
});

test("solver reports an abusive student mid-call: the call ends, the student's rating is held, upheld → paused", { skip: NOW_SKIP }, async () => {
  const { student, solver, sessionId, requestId } = await finishedHumanCall({ end: false });
  const { reportId } = await reportSession(solver.userId, sessionId, { reason: "abuse", details: "Shouting", block: true }, new Date());
  assert.equal(await status(requestId), "ended", "a safety report ends a live call");
  await assert.rejects(reportSession(solver.userId, sessionId, { reason: "other", details: null, block: false }), /already reported/);

  await rateSession(student, sessionId, { stars: 1, tags: ["not_resolved"], comment: null, tipCoins: 0 });
  const held = await rawPool().query(`SELECT held_until_case_closes, counted FROM now.ratings WHERE session_id = $1`, [sessionId]);
  assert.equal(held.rows[0].held_until_case_closes, true);

  const admin = await seedUser("Grievance Officer");
  await resolveReport(admin, reportId, "upheld", "Recording confirms abuse.");
  const after = await rawPool().query(`SELECT held_until_case_closes, counted FROM now.ratings WHERE session_id = $1`, [sessionId]);
  assert.deepEqual(after.rows[0], { held_until_case_closes: false, counted: false }, "a reported abuser's rating never counts");

  // One upheld abuse report pauses the student until reviewed.
  await assert.rejects(createRequest(student, { questionId: await seedAttemptedQuestion(student, "physics") }), /paused/);
  const suspension = await rawPool().query(`SELECT id, ends_at FROM now.suspensions WHERE user_id = $1 AND scope = 'student'`, [student]);
  assert.equal(suspension.rows[0].ends_at, null);
  const guardian = await rawPool().query(`SELECT type FROM now.events WHERE type LIKE 'guardian.%' AND payload->>'studentId' = $1`, [student]);
  assert.equal(guardian.rows[0]?.type, "guardian.notify_skipped", "an adult has no guardian on file");

  // The solver blocked the student: their next request is never offered to that solver.
  await liftSuspension(admin, suspension.rows[0].id);
  await offlineEveryone();
  await heartbeatHelper(solver.userId, null);
  const next = await createRequest(student, { questionId: await seedAttemptedQuestion(student, "physics") });
  const offers = await rawPool().query(`SELECT count(*)::int AS n FROM now.offers WHERE request_id = $1`, [next.id]);
  assert.equal(offers.rows[0].n, 0);
  assert.equal(next.session?.solverKind, "bot", "blocked both ways: nobody else online, so the bot");
  await assertLedgerBalanced();
});

test("reports against a solver freeze their coins; two in 30 days restrict them; reinstate thaws", { skip: NOW_SKIP }, async () => {
  const solver = await seedHelper("physics");
  const first = await finishedHumanCall({ solver });
  await reportSession(first.student, first.sessionId, { reason: "wrong_content", details: null, block: false });
  const frozen = await rawPool().query(`SELECT frozen FROM now.accounts WHERE id = $1`, [`user:${solver.userId}`]);
  assert.equal(frozen.rows[0].frozen, true);
  let helper = await rawPool().query(`SELECT verification_status FROM now.helpers WHERE id = $1`, [solver.helperId]);
  assert.equal(helper.rows[0].verification_status, "verified", "one report is not enough");

  const second = await finishedHumanCall({ solver });
  const { reportId } = await reportSession(second.student, second.sessionId, { reason: "other", details: "Rushed", block: false });
  helper = await rawPool().query(`SELECT verification_status, restricted_reason FROM now.helpers WHERE id = $1`, [solver.helperId]);
  assert.equal(helper.rows[0].verification_status, "restricted");
  assert.match(helper.rows[0].restricted_reason, /2 reports/);
  const restricted = await rawPool().query(`SELECT count(*)::int AS n FROM now.events WHERE type = 'helper.restricted' AND payload->>'helperId' = $1`, [
    solver.helperId,
  ]);
  assert.equal(restricted.rows[0].n, 1);
  await assert.rejects(heartbeatHelper(solver.userId, null), /on hold/, "a restricted solver cannot go online");

  // Dismissing the cases and reinstating thaws the wallet.
  const admin = await seedUser("Admin");
  await resolveReport(admin, reportId, "dismissed", "Explanation was fine.");
  const open = await rawPool().query(`SELECT id FROM now.reports WHERE reported_helper_id = $1 AND status = 'open'`, [solver.helperId]);
  for (const row of open.rows) await resolveReport(admin, row.id, "dismissed", "Not a fault.");
  await reinstateHelper(admin, solver.helperId, "Reviewed both calls.");
  helper = await rawPool().query(`SELECT verification_status FROM now.helpers WHERE id = $1`, [solver.helperId]);
  assert.equal(helper.rows[0].verification_status, "verified");
  const thawed = await rawPool().query(`SELECT frozen FROM now.accounts WHERE id = $1`, [`user:${solver.userId}`]);
  assert.equal(thawed.rows[0].frozen, false);
});

test("an upheld report suspends a solver at once and keeps the coins frozen until reinstated", { skip: NOW_SKIP }, async () => {
  const solver = await seedHelper("physics");
  const call = await finishedHumanCall({ solver });
  const { reportId } = await reportSession(call.student, call.sessionId, { reason: "contact_sharing", details: "Asked for my number", block: true });
  const admin = await seedUser("Admin");
  await resolveReport(admin, reportId, "upheld", "Confirmed on the recording.");
  const helper = await rawPool().query(`SELECT verification_status FROM now.helpers WHERE id = $1`, [solver.helperId]);
  assert.equal(helper.rows[0].verification_status, "restricted");
  const suspension = await rawPool().query(`SELECT scope, ends_at FROM now.suspensions WHERE user_id = $1`, [solver.userId]);
  assert.deepEqual(suspension.rows[0], { scope: "solver", ends_at: null });
  assert.equal((await rawPool().query(`SELECT frozen FROM now.accounts WHERE id = $1`, [`user:${solver.userId}`])).rows[0].frozen, true);
  await assert.rejects(resolveReport(admin, reportId, "dismissed", "Changed my mind"), /already closed/);
  await reinstateHelper(admin, solver.helperId, "Warning given; retrained.");
  assert.equal((await rawPool().query(`SELECT frozen FROM now.accounts WHERE id = $1`, [`user:${solver.userId}`])).rows[0].frozen, false);
});

test("automatic review: two 'not solved' tags in a day restrict a solver", { skip: NOW_SKIP }, async () => {
  const solver = await seedHelper("physics");
  for (let i = 0; i < 2; i++) {
    const call = await finishedHumanCall({ solver });
    await rateSession(call.student, call.sessionId, { stars: 3, tags: ["not_resolved"], comment: null, tipCoins: 0 });
  }
  const helper = await rawPool().query(`SELECT verification_status, restricted_reason FROM now.helpers WHERE id = $1`, [solver.helperId]);
  assert.equal(helper.rows[0].verification_status, "restricted");
  assert.match(helper.rows[0].restricted_reason, /Not resolved/);
});
