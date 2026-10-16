/**
 * Regression tests for the bugs found in the post-build review (plan doc
 * decisions B64–B75). Each test failed, or would have, on the code before the
 * fix. Real Postgres; LiveKit is a fetch stub where it matters.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  liftSuspension,
  reportSession,
  resolveReport,
  setWalletFrozenByAdmin,
} from "@/server/now/after-call-service";
import {
  cancelRequest,
  createRequest,
  getCurrentOffer,
  getRequestView,
  heartbeatHelper,
  respondToOffer,
} from "@/server/now/dispatch-service";
import { __setLiveKitFetchForTests } from "@/server/now/livekit";
import { getWalletBalance } from "@/server/now/ledger-store";
import { clearPresence, helperStreamId, readNowEvents } from "@/server/now/now-realtime";
import { BOT_HELPER_ID } from "@/server/now/solver-service";
import { endSession, handleNoShow, joinSession, runNowNightly, runNowSweep } from "@/server/now/session-service";
import { buyStoreItem, upsertStoreItem } from "@/server/now/store-service";
import { getOgcodeCatalogCounts } from "@/server/ogcode-catalog";
import { setSetting } from "@/server/platform-settings";
import { NO_SHOW_WINDOW_MS } from "@/server/now/types";

import { closePool, makeId, rawPool } from "./_db";
import {
  EASY_HUMAN,
  NOW_SKIP,
  WELCOME,
  assertLedgerBalanced,
  cleanupNowFixtures,
  helpersMade,
  questionsMade,
  seedAttemptedQuestion,
  seedHelper,
  seedStudent,
  seedUser,
  sessionOf,
  setup,
  status,
} from "./_now";

test.after(async () => {
  __setLiveKitFetchForTests(null);
  await cleanupNowFixtures();
  await closePool();
});

async function offline() {
  for (const id of helpersMade) await clearPresence(id);
}

async function liveHumanSession(subject = "physics") {
  await setup();
  await offline();
  const student = await seedStudent();
  const solver = await seedHelper(subject);
  await heartbeatHelper(solver.userId, null);
  const request = await createRequest(student, { questionId: await seedAttemptedQuestion(student, subject) });
  const offer = (await getCurrentOffer(solver.userId))!;
  const { sessionId } = await respondToOffer(solver.userId, offer.offerId, "accept", null);
  await joinSession(student, sessionId!);
  await joinSession(solver.userId, sessionId!);
  return { student, solver, requestId: request.id, sessionId: sessionId! };
}

test("B64: a solver who reports an abusive student still gets paid", { skip: NOW_SKIP }, async () => {
  const { solver, sessionId } = await liveHumanSession();
  await reportSession(solver.userId, sessionId, { reason: "abuse", details: "Shouting", block: true });
  // The report ended the call without an outcome; the solver records it afterwards.
  const { recordOutcome } = await import("@/server/now/session-service");
  await recordOutcome(solver.userId, sessionId, "partial", null);
  const s = await sessionOf((await rawPool().query(`SELECT request_id FROM now.sessions WHERE id = $1`, [sessionId])).rows[0].request_id);
  assert.equal(s.payable, true, "the solver's own report does not cost them the session");
  assert.equal((await getWalletBalance(solver.userId)).pending, EASY_HUMAN);
  await assertLedgerBalanced();
});

test("B64: a student's report holds the coins until the case closes (dismissed → paid, upheld → refunded)", { skip: NOW_SKIP }, async () => {
  const admin = await seedUser("Admin");
  for (const outcome of ["dismissed", "upheld"] as const) {
    const { student, solver, requestId, sessionId } = await liveHumanSession();
    // The student reports before the solver has recorded an outcome.
    await endSession({ userId: student }, sessionId);
    const { reportId } = await reportSession(student, sessionId, { reason: "wrong_content", details: null, block: false });
    const { recordOutcome } = await import("@/server/now/session-service");
    await recordOutcome(solver.userId, sessionId, "resolved", null);
    let s = await sessionOf(requestId);
    assert.equal(s.settled_at, null, "deferred while the case is open");
    await resolveReport(admin, reportId, outcome, "Checked the recording.");
    s = await sessionOf(requestId);
    assert.ok(s.settled_at, `settled once the case was ${outcome}`);
    if (outcome === "dismissed") {
      assert.equal(s.payable, true);
      assert.equal((await getWalletBalance(solver.userId)).pending, EASY_HUMAN);
    } else {
      assert.equal(s.payable, false);
      assert.equal((await getWalletBalance(student)).available, WELCOME, "upheld: the student gets the coins back");
    }
  }
  await assertLedgerBalanced();
});

test("B65: a bot session goes live only when LiveKit shows the agent; a bot that never comes is refunded, not looped", { skip: NOW_SKIP }, async () => {
  const saved = { ...process.env };
  let agentInRoom = false;
  process.env.LIVEKIT_URL = "wss://test.livekit.invalid";
  process.env.LIVEKIT_API_KEY = "APItest";
  process.env.LIVEKIT_API_SECRET = "integration-test-livekit-secret-32b!";
  __setLiveKitFetchForTests(async (url) => {
    if (url.endsWith("/ListParticipants")) {
      return new Response(
        JSON.stringify({ participants: agentInRoom ? [{ identity: "agent-1", kind: "AGENT" }, { identity: "EG_1", kind: "EGRESS" }] : [{ identity: "EG_1", kind: "EGRESS" }] }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify(url.endsWith("CreateDispatch") ? { id: "AD_1" } : {}), { status: 200 });
  });
  try {
    await setup();
    await offline();
    // Never arrives: student joins, no agent → not live; 2 minutes → refund, no second bot.
    const student = await seedStudent();
    const request = await createRequest(student, { questionId: await seedAttemptedQuestion(student, "chemistry") });
    const sessionId = request.session!.id;
    assert.equal(request.session?.solverJoined, false);
    assert.equal((await joinSession(student, sessionId)).live, false, "no agent in the room: not live, not charged");
    await handleNoShow(sessionId, new Date(Date.now() + NO_SHOW_WINDOW_MS + 1_000));
    assert.equal(await status(request.id), "no_helper", "the bot is not sent again for the same request");
    assert.equal((await getWalletBalance(student)).available, WELCOME);
    const sessions = await rawPool().query(`SELECT count(*)::int AS n FROM now.sessions WHERE request_id = $1`, [request.id]);
    assert.equal(sessions.rows[0].n, 1);

    // Arrives: the client calls join again when the agent connects → live.
    const student2 = await seedStudent();
    const request2 = await createRequest(student2, { questionId: await seedAttemptedQuestion(student2, "chemistry") });
    const session2 = request2.session!.id;
    assert.equal((await joinSession(student2, session2)).live, false);
    agentInRoom = true;
    assert.equal((await joinSession(student2, session2)).live, true);
    const row = await rawPool().query(`SELECT helper_id FROM now.sessions WHERE id = $1`, [session2]);
    assert.equal(row.rows[0].helper_id, BOT_HELPER_ID);
  } finally {
    __setLiveKitFetchForTests(null);
    process.env = saved;
  }
  await assertLedgerBalanced();
});

test("B66: one request that always fails does not stop the sweep for the others", { skip: NOW_SKIP }, async () => {
  await setup();
  await offline();
  // Both requests wait at first (the bot only after 60 s), then the sweep hands them to the bot.
  await setSetting(
    "now_bot_rule",
    JSON.stringify({ enabled: true, whenNoneOnline: false, afterFailedOffers: 3, afterMs: 60_000, disabledSubjects: [] }),
    null,
  );
  // A broken price table: no bot price for Easy, so the Easy request's bot step throws every time.
  await rawPool().query(`DELETE FROM now.prices`);
  await rawPool().query(
    `INSERT INTO now.prices (difficulty, solver_kind, price_coins, minutes, extension_minutes, extension_coins, max_extensions)
     SELECT d, k, 40, 5, 2, 20, 2 FROM unnest(ARRAY['easy','medium','hard','insane']) d, unnest(ARRAY['human','bot']) k
      WHERE NOT (d = 'easy' AND k = 'bot')`,
  );
  try {
    const a = await seedStudent();
    const poisoned = await createRequest(a, { questionId: await seedAttemptedQuestion(a, "physics") }); // Easy, older
    assert.equal(poisoned.status, "requested");

    const b = await seedStudent();
    await getOgcodeCatalogCounts();
    const medium = makeId("q");
    questionsMade.push(medium);
    await rawPool().query(
      `INSERT INTO ogcode_questions (id, source_index, text, options, correct_option, explanation, subject, chapter, concept, difficulty, question_type)
       VALUES ($1, $2, 'Medium one', $3::jsonb, 0, 'x', 'physics', 'Kinematics', 'Projectile', 'Medium', 'mcq')`,
      [medium, 900_000 + Math.floor(Math.random() * 90_000), JSON.stringify(["A", "B"])],
    );
    await rawPool().query(`INSERT INTO ogcode_question_progress (user_id, question_id, total_attempts, attempted) VALUES ($1, $2, 1, TRUE)`, [b, medium]);
    const healthy = await createRequest(b, { questionId: medium });
    assert.equal(healthy.status, "requested");

    const counts = await runNowSweep(new Date(Date.now() + 2 * 60_000));
    assert.ok(counts.dispatched >= 1, "the healthy request behind the broken one was dispatched");
    assert.equal(await status(healthy.id), "accepted", "the bot took the healthy request");
    assert.equal(await status(poisoned.id), "requested", "the broken one waits (and is logged) without blocking others");
    await cancelRequest(a, poisoned.id);
    await cancelRequest(b, healthy.id);
  } finally {
    await rawPool().query(`DELETE FROM now.prices`);
  }
});

test("B67: a solver holding an open offer is not offered a second doubt", { skip: NOW_SKIP }, async () => {
  await setup();
  await offline();
  const solver = await seedHelper("physics");
  await heartbeatHelper(solver.userId, null);
  const s1 = await seedStudent();
  const s2 = await seedStudent();
  const first = await createRequest(s1, { questionId: await seedAttemptedQuestion(s1, "physics") });
  const second = await createRequest(s2, { questionId: await seedAttemptedQuestion(s2, "physics") });
  assert.equal(first.status, "offered");
  assert.notEqual(second.status, "offered", "the only solver is busy with an open offer");
  const offers = await rawPool().query(`SELECT count(*)::int AS n FROM now.offers WHERE request_id = $1`, [second.id]);
  assert.equal(offers.rows[0].n, 0);
  await cancelRequest(s1, first.id);
  if (["requested", "offered", "accepted"].includes(await status(second.id))) await cancelRequest(s2, second.id);
});

test("B68: after a solver no-show the student sees the request waiting again, not 'session ended'", { skip: NOW_SKIP }, async () => {
  await setup();
  await offline();
  await setSetting(
    "now_bot_rule",
    JSON.stringify({ enabled: false, whenNoneOnline: false, afterFailedOffers: null, afterMs: null, disabledSubjects: [] }),
    null,
  );
  const student = await seedStudent();
  const solver = await seedHelper("physics");
  const other = await seedHelper("physics");
  await heartbeatHelper(solver.userId, null);
  const request = await createRequest(student, { questionId: await seedAttemptedQuestion(student, "physics") });
  const offer = (await getCurrentOffer(solver.userId))!;
  const { sessionId } = await respondToOffer(solver.userId, offer.offerId, "accept", null);
  await joinSession(student, sessionId!);
  await clearPresence(solver.helperId);
  await heartbeatHelper(other.userId, null, new Date(Date.now() + NO_SHOW_WINDOW_MS + 1_000));
  assert.equal(await handleNoShow(sessionId!, new Date(Date.now() + NO_SHOW_WINDOW_MS + 1_000)), "helper");
  const view = await getRequestView(request.id, { viewerUserId: student });
  assert.ok(["requested", "offered"].includes(view.status));
  assert.equal(view.session, null, "the old ended session is not shown as this request's session");
  await cancelRequest(student, request.id);
});

test("B69: cancelling while a solver is being asked closes their offer card", { skip: NOW_SKIP }, async () => {
  await setup();
  await offline();
  const student = await seedStudent();
  const solver = await seedHelper("physics");
  await heartbeatHelper(solver.userId, null);
  const request = await createRequest(student, { questionId: await seedAttemptedQuestion(student, "physics") });
  const offer = (await getCurrentOffer(solver.userId))!;
  await cancelRequest(student, request.id);
  const events = await readNowEvents(helperStreamId(solver.helperId), "0-0", { count: 50, blockMs: 0 });
  assert.ok(events.some((e) => e.event.type === "offer_closed" && e.event.offerId === offer.offerId));
  assert.equal(await getCurrentOffer(solver.userId), null);
});

test("B70: the same store tap twice at once charges once", { skip: NOW_SKIP }, async () => {
  await setup();
  const student = await seedStudent();
  await (await import("@/server/now/wallet-service")).ensureWelcomeGrant(student);
  const item = await upsertStoreItem({ kind: "premium", title: "Physics 7 days", priceCoins: 25, premiumSubject: "physics", premiumDays: 7 });
  const [a, b] = await Promise.all([buyStoreItem(student, item.id, "same-key"), buyStoreItem(student, item.id, "same-key")]);
  assert.equal(a.order.id, b.order.id);
  assert.equal((await getWalletBalance(student)).available, WELCOME - 25);
  const grants = await rawPool().query(`SELECT count(*)::int AS n FROM entitlements.subject_grants WHERE user_id = $1`, [student]);
  assert.equal(grants.rows[0].n, 1);
});

test("B71: requests that closed with no solver do not use up the daily limit", { skip: NOW_SKIP }, async () => {
  await setup();
  await offline();
  await setSetting(
    "now_bot_rule",
    JSON.stringify({ enabled: false, whenNoneOnline: false, afterFailedOffers: null, afterMs: null, disabledSubjects: [] }),
    null,
  );
  const student = await seedStudent();
  for (let i = 0; i < 3; i++) {
    const r = await createRequest(student, { questionId: await seedAttemptedQuestion(student, "physics") });
    assert.equal(r.status, "no_helper");
  }
  const fourth = await createRequest(student, { questionId: await seedAttemptedQuestion(student, "physics") });
  assert.equal(fourth.status, "no_helper", "allowed: the three before never reached anyone");
});

test("B72 + B73: a solver pause is lifted by reinstating; a refund-shortfall freeze survives a dismissed report", { skip: NOW_SKIP }, async () => {
  const { student, solver, sessionId } = await liveHumanSession();
  await endSession({ userId: solver.userId }, sessionId, { outcome: "resolved" });
  const admin = await seedUser("Admin");
  // Upheld → solver pause; lifting it directly is refused.
  const first = await reportSession(student, sessionId, { reason: "contact_sharing", details: null, block: false });
  await resolveReport(admin, first.reportId, "upheld", "Confirmed.");
  const pause = await rawPool().query(`SELECT id FROM now.suspensions WHERE user_id = $1 AND scope = 'solver'`, [solver.userId]);
  await assert.rejects(liftSuspension(admin, pause.rows[0].id), /Reinstate/);

  // A wallet frozen for a coin-pack refund shortfall stays frozen when a report is dismissed.
  const other = await liveHumanSession();
  await endSession({ userId: other.solver.userId }, other.sessionId, { outcome: "resolved" });
  await rawPool().query(`INSERT INTO now.events (type, actor, payload) VALUES ('wallet.refund_shortfall', 'system', $1::jsonb)`, [
    JSON.stringify({ userId: other.solver.userId, shortfall: 10 }),
  ]);
  const report = await reportSession(other.student, other.sessionId, { reason: "other", details: null, block: false });
  await resolveReport(admin, report.reportId, "dismissed", "Fine.");
  const frozen = await rawPool().query(`SELECT frozen FROM now.accounts WHERE id = $1`, [`user:${other.solver.userId}`]);
  assert.equal(frozen.rows[0].frozen, true, "the shortfall freeze is not undone by an unrelated dismissal");
  await setWalletFrozenByAdmin(admin, other.solver.userId, false, "Shortfall repaid in person.");
  const thawed = await rawPool().query(`SELECT frozen FROM now.accounts WHERE id = $1`, [`user:${other.solver.userId}`]);
  assert.equal(thawed.rows[0].frozen, false);
});

test("B74: if nobody joins, the request closes instead of ringing another solver", { skip: NOW_SKIP }, async () => {
  await setup();
  await offline();
  const student = await seedStudent();
  const solver = await seedHelper("physics");
  await heartbeatHelper(solver.userId, null);
  const request = await createRequest(student, { questionId: await seedAttemptedQuestion(student, "physics") });
  const offer = (await getCurrentOffer(solver.userId))!;
  const { sessionId } = await respondToOffer(solver.userId, offer.offerId, "accept", null);
  assert.equal(await handleNoShow(sessionId!, new Date(Date.now() + NO_SHOW_WINDOW_MS + 1_000)), "both");
  assert.equal(await status(request.id), "no_show");
  assert.equal((await getWalletBalance(student)).available, WELCOME);
});

test("B75: the rating window counts from the session that actually happened", { skip: NOW_SKIP }, async () => {
  await setup();
  await offline();
  const student = await seedStudent();
  const first = await seedHelper("physics");
  await heartbeatHelper(first.userId, null);
  const request = await createRequest(student, { questionId: await seedAttemptedQuestion(student, "physics") });
  const offer = (await getCurrentOffer(first.userId))!;
  const { sessionId: lost } = await respondToOffer(first.userId, offer.offerId, "accept", null);
  await joinSession(student, lost!);
  // The first solver vanished two days ago (backdated), then the bot took the doubt today.
  await handleNoShow(lost!, new Date(Date.now() + NO_SHOW_WINDOW_MS + 1_000));
  await rawPool().query(`UPDATE now.sessions SET ended_at = NOW() - interval '2 days' WHERE id = $1`, [lost]);
  const view = await getRequestView(request.id, { viewerUserId: student });
  assert.equal(view.session?.solverKind, "bot");
  await joinSession(student, view.session!.id);
  await endSession({ userId: student }, view.session!.id);
  const nightly = await runNowNightly(new Date(Date.now() + 60 * 60_000));
  void nightly;
  assert.equal(await status(request.id), "ended", "still inside the 24 h window of today's session");
});
