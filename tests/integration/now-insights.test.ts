/**
 * Admin console views and the two dashboards against a real Postgres: one
 * finished human call (rated + tipped), one bot call, then every read model.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { rateSession } from "@/server/now/after-call-service";
import { getLiveMonitor, getNowMetrics, getSessionReview, listSessionsForAdmin, searchPeople } from "@/server/now/admin-insights-service";
import { getSolverDashboard, getStudentDashboard, setFavourite } from "@/server/now/dashboard-service";
import { createRequest, getCurrentOffer, heartbeatHelper, respondToOffer } from "@/server/now/dispatch-service";
import { clearPresence } from "@/server/now/now-realtime";
import { endSession, joinSession } from "@/server/now/session-service";

import { closePool } from "./_db";
import { EASY_HUMAN, NOW_SKIP, cleanupNowFixtures, helpersMade, seedAttemptedQuestion, seedHelper, seedStudent, setup } from "./_now";

test.after(async () => {
  await cleanupNowFixtures();
  await closePool();
});

test("monitor, sessions, review, metrics, people and both dashboards read what the feature wrote", { skip: NOW_SKIP }, async () => {
  await setup();
  for (const id of helpersMade) await clearPresence(id);
  const student = await seedStudent();
  const solver = await seedHelper("physics");
  await heartbeatHelper(solver.userId, null);

  // A human call, rated with a tip.
  await createRequest(student, { questionId: await seedAttemptedQuestion(student, "physics") });
  const offer = (await getCurrentOffer(solver.userId))!;
  const { sessionId } = await respondToOffer(solver.userId, offer.offerId, "accept", null);
  await joinSession(student, sessionId!);
  await joinSession(solver.userId, sessionId!);

  const monitorLive = await getLiveMonitor();
  assert.ok(monitorLive.live.some((l) => l.sessionId === sessionId));
  assert.equal(monitorLive.online.physics.count >= 1, true);

  await endSession({ userId: solver.userId }, sessionId!, { outcome: "resolved", rootCause: "conceptual_gap" });
  await rateSession(student, sessionId!, { stars: 5, tags: ["clear_explanation", "friendly"], comment: "Super clear", tipCoins: 10 });

  // A bot call.
  await clearPresence(solver.helperId);
  const botRequest = await createRequest(student, { questionId: await seedAttemptedQuestion(student, "chemistry") });
  await joinSession(student, botRequest.session!.id);
  await endSession({ userId: student }, botRequest.session!.id);

  const monitor = await getLiveMonitor();
  assert.ok(monitor.today.requests >= 2);
  assert.ok(monitor.today.humanSessions >= 1);
  assert.ok(monitor.today.botSessions >= 1);
  assert.ok(monitor.today.humanConnectWithin10 !== null && monitor.today.humanConnectWithin10 > 0);

  const sessions = await listSessionsForAdmin({ solverKind: "human" });
  const row = sessions.find((s) => s.sessionId === sessionId)!;
  assert.equal(row.stars, 5);
  assert.equal(row.outcome, "resolved");
  assert.equal(row.studentName, "Meera Iyer", "admins see full names");

  const review = await getSessionReview(sessionId!);
  assert.ok(review);
  assert.equal(review.offers.length, 1);
  assert.ok(review.events.some((e: { type: string }) => e.type === "session.settled"));
  assert.ok(review.ledger.some((l: { kind: string }) => l.kind === "tip"));

  const metrics = await getNowMetrics();
  const m = metrics.solvers.find((s) => s.helperId === solver.helperId)!;
  assert.equal(m.acceptRate, 1);
  assert.equal(m.monthCoins, EASY_HUMAN + 10);
  assert.equal(m.topThreeShare, 1);
  assert.equal(m.concentrationFlag, true, "all of this month's coins came from one student");
  assert.ok(metrics.fallbackByDifficulty.easy.sessions >= 2);

  const people = await searchPeople("meera");
  assert.ok(people.some((p) => p.id === student && p.inCohort));
  assert.deepEqual(await searchPeople("me"), [], "too short to search");

  // Student dashboard + favourites.
  await setFavourite(student, solver.helperId, true);
  const sd = await getStudentDashboard(student);
  assert.equal(sd.summary.asked, 2);
  assert.equal(sd.summary.resolved, 1);
  assert.ok(sd.summary.coinsSpentThisMonth >= EASY_HUMAN + 10);
  assert.equal(sd.mySolvers[0].helperId, solver.helperId);
  assert.equal(sd.mySolvers[0].favourite, true);
  assert.equal(sd.mySolvers[0].name, "Ravi");
  assert.equal(sd.history.length, 2);
  assert.equal(sd.history.find((h) => h.sessionId === sessionId)?.stars, 5);
  assert.equal(sd.history.find((h) => h.solverKind === "bot")?.solverName, "Origin");
  assert.ok(sd.weakSpots.some((w) => w.concept === "Projectile" && w.commonRootCause === "conceptual_gap"));
  const other = await seedStudent();
  await assert.rejects(setFavourite(other, solver.helperId, true), /after a session/);

  // Solver dashboard.
  const solverDash = await getSolverDashboard(solver.userId);
  assert.equal(solverDash.summary.solvedToday, 1);
  assert.equal(solverDash.summary.resolutionRate, 1);
  assert.equal(solverDash.summary.averageStars, 5);
  assert.equal(solverDash.earnings.pending, EASY_HUMAN + 10);
  assert.deepEqual(
    solverDash.feedback.tags.map((t) => t.tag).sort(),
    ["clear_explanation", "friendly"],
  );
  assert.equal(solverDash.feedback.recentComments[0].studentFirstName, "Meera", "first name only");
  assert.ok(solverDash.activity.length >= 1 && solverDash.activity[0].hoursOnline >= 0);
  assert.equal(solverDash.byDifficulty.find((d) => d.difficulty === "easy")?.solved, 1);
  assert.equal(JSON.stringify(solverDash).includes("Iyer"), false, "no student surname anywhere");
  await assert.rejects(getSolverDashboard(student), /not an Origin NOW solver/);
});
