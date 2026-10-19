/**
 * Phase 1 capstone: one whole pilot journey through the real services on a
 * real Postgres, the way the internal test will run it by hand.
 *
 *   a minor's guardian consents → the student asks from the question page →
 *   a solver on shift accepts → both join → more time is bought → the solver
 *   ends with an outcome → coins settle (pending) → the student rates + tips
 *   and gets practice → a report is opened and dismissed → 24 h later the
 *   solver's coins are spendable → the solver buys premium in the store →
 *   both dashboards and the admin views agree → the ledger balances.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { getAfterCall, rateSession, reportSession, resolveReport } from "@/server/now/after-call-service";
import { getLiveMonitor, getNowMetrics, getSessionReview } from "@/server/now/admin-insights-service";
import { confirmConsent, startGuardianConsent } from "@/server/now/consent-service";
import { getSolverDashboard, getStudentDashboard } from "@/server/now/dashboard-service";
import { createRequest, getCurrentOffer, heartbeatHelper, quoteLiveHelp, respondToOffer } from "@/server/now/dispatch-service";
import { getWalletBalance } from "@/server/now/ledger-store";
import { getNowAccess } from "@/server/now/now-access";
import { clearPresence } from "@/server/now/now-realtime";
import { confirmExtension, endSession, joinSession, requestExtension, runNowNightly } from "@/server/now/session-service";
import { buyStoreItem, upsertStoreItem } from "@/server/now/store-service";
import { RATING_WINDOW_MS } from "@/server/now/types";

import { closePool, makeId, rawPool } from "./_db";
import {
  EASY_EXTENSION,
  EASY_HUMAN,
  NOW_SKIP,
  WELCOME,
  assertLedgerBalanced,
  cleanupNowFixtures,
  helpersMade,
  seedAttemptedQuestion,
  seedHelper,
  seedUser,
  setup,
} from "./_now";

test.after(async () => {
  await cleanupNowFixtures();
  await closePool();
});

/** The dev email mock logs the consent link; capture its token. */
async function captureToken(run: () => Promise<unknown>): Promise<string> {
  const original = console.warn;
  let token = "";
  console.warn = (...args: unknown[]) => {
    const match = JSON.stringify(args).match(/token=([A-Za-z0-9_-]{20,})/);
    if (match) token = match[1];
  };
  try {
    await run();
  } finally {
    console.warn = original;
  }
  assert.ok(token, "the guardian email carried a link");
  return token;
}

test("one pilot journey, end to end", { skip: NOW_SKIP }, async () => {
  await setup();
  for (const id of helpersMade) await clearPresence(id);

  // 1. A 15-year-old in the pilot cohort, no consent yet.
  const student = makeId("now_minor");
  await rawPool().query(
    `INSERT INTO origin_users (id, name, email, role, password_hash) VALUES ($1, 'Isha Verma', $2, 'student', 'x')`,
    [student, `${student}@example.com`],
  );
  await rawPool().query(`INSERT INTO now.pilot_cohort (user_id) VALUES ($1)`, [student]);
  const questionId = await seedAttemptedQuestion(student, "physics");
  assert.equal((await getNowAccess(student)).blockedReason, "needs_guardian_consent");
  assert.equal((await quoteLiveHelp(student, questionId)).blockedReason, "needs_guardian_consent");

  // 2. Guardian consents from the email link.
  const dob = `${new Date().getUTCFullYear() - 15}-03-01`;
  const token = await captureToken(() =>
    startGuardianConsent({
      userId: student,
      purpose: "student",
      dateOfBirth: dob,
      guardianName: "Anita Verma",
      guardianEmail: "anita.verma@example.com",
      guardianPhone: null,
      relationship: "mother",
    }),
  );
  await confirmConsent({ token, acceptedPolicy: true });
  assert.equal((await getNowAccess(student)).canRequest, true);

  // 3. A solver on shift; the button quotes the human price.
  const solver = await seedHelper("physics");
  await heartbeatHelper(solver.userId, null);
  const quote = await quoteLiveHelp(student, questionId);
  assert.equal(quote.available, true);
  assert.equal(quote.humansLikely, true);
  assert.equal(quote.priceCoins, EASY_HUMAN);

  // 4. Ask → offer → accept → both join → live.
  const request = await createRequest(student, { questionId });
  const offer = (await getCurrentOffer(solver.userId))!;
  assert.equal(offer.requestId, request.id);
  const { sessionId } = await respondToOffer(solver.userId, offer.offerId, "accept", null);
  await joinSession(student, sessionId!);
  assert.equal((await joinSession(solver.userId, sessionId!)).live, true);

  // 5. More time: the student asks, the solver agrees, the student pays.
  await requestExtension(student, sessionId!);
  await confirmExtension({ helperUserId: solver.userId }, sessionId!);

  // 6. The solver ends with an outcome → settled, payable, pending for 24 h.
  await endSession({ userId: solver.userId }, sessionId!, { outcome: "resolved", rootCause: "conceptual_gap" });
  const earned = EASY_HUMAN + EASY_EXTENSION;
  assert.deepEqual(
    { available: (await getWalletBalance(solver.userId)).available, pending: (await getWalletBalance(solver.userId)).pending },
    { available: 0, pending: earned },
  );

  // 7. Rating + tip + practice.
  const after = await rateSession(student, sessionId!, { stars: 5, tags: ["clear_explanation"], comment: "Thank you!", tipCoins: 10 });
  assert.equal(after.rating?.stars, 5);
  assert.equal((await getAfterCall(student, sessionId!)).canRate, false);
  assert.equal((await getWalletBalance(student)).available, WELCOME - earned - 10);

  // 8. A report is opened (the solver's coins freeze) and dismissed (they thaw).
  const { reportId } = await reportSession(student, sessionId!, { reason: "other", details: "Audio was choppy", block: false });
  const frozen = await rawPool().query(`SELECT frozen FROM now.accounts WHERE id = $1`, [`user:${solver.userId}`]);
  assert.equal(frozen.rows[0].frozen, true);
  const admin = await seedUser("Grievance Officer");
  await resolveReport(admin, reportId, "dismissed", "Network issue, not conduct.");
  const thawed = await rawPool().query(`SELECT frozen FROM now.accounts WHERE id = $1`, [`user:${solver.userId}`]);
  assert.equal(thawed.rows[0].frozen, false);

  // 9. A day later: rating window closed, coins spendable, spent in the store.
  const later = new Date(Date.now() + RATING_WINDOW_MS + 60 * 60_000);
  await runNowNightly(later);
  const spendable = await getWalletBalance(solver.userId, later);
  assert.equal(spendable.available, earned + 10);
  const premium = await upsertStoreItem({ kind: "premium", title: "Chemistry premium, 7 days", priceCoins: 30, premiumSubject: "chemistry", premiumDays: 7 });
  const order = await buyStoreItem(solver.userId, premium.id, "journey-1", later);
  assert.equal(order.order.status, "fulfilled");
  assert.equal((await getWalletBalance(solver.userId, later)).available, earned + 10 - 30);

  // 10. Everyone's view agrees.
  const studentDash = await getStudentDashboard(student);
  assert.equal(studentDash.summary.resolved, 1);
  assert.equal(studentDash.history[0].stars, 5);
  const solverDash = await getSolverDashboard(solver.userId, later);
  assert.equal(solverDash.summary.solvedAllTime, 1);
  assert.equal(solverDash.feedback.recentComments[0].studentFirstName, "Isha");
  const review = await getSessionReview(sessionId!);
  assert.equal(review?.payable, true);
  assert.equal(review?.extensionsUsed, 1);
  assert.ok((await getLiveMonitor()).today.humanSessions >= 1);
  assert.ok((await getNowMetrics()).solvers.some((s) => s.helperId === solver.helperId && s.sessions === 1));
  await clearPresence(solver.helperId);
  await assertLedgerBalanced();
});
