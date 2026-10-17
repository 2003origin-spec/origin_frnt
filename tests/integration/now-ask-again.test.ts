/**
 * "Ask again" (pilot readiness item 2) against a real Postgres: a student asks
 * one of their own solvers first; that solver gets the first offer even
 * though another is a favourite and their chapter list does not match; if
 * they decline, normal matching carries on. Strangers cannot be chosen.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { setFavourite } from "@/server/now/dashboard-service";
import {
  cancelRequest,
  createRequest,
  getCurrentOffer,
  getRequestView,
  heartbeatHelper,
  quoteLiveHelp,
  respondToOffer,
} from "@/server/now/dispatch-service";
import { clearPresence } from "@/server/now/now-realtime";

import { closePool, makeId, rawPool } from "./_db";
import { NOW_SKIP, cleanupNowFixtures, helpersMade, seedAttemptedQuestion, seedHelper, seedStudent, setup, status } from "./_now";

test.after(async () => {
  await cleanupNowFixtures();
  await closePool();
});

/** A finished call between the student and a solver, a day ago. */
async function pastSession(studentId: string, helperId: string) {
  const requestId = makeId("req");
  const ended = new Date(Date.now() - 24 * 60 * 60_000);
  await rawPool().query(
    `INSERT INTO now.requests (id, student_id, question_id, subject, difficulty, price_coins, status, created_at, helper_id)
     VALUES ($1, $2, 'q_past', 'physics', 'easy', 40, 'rated', $3, $4)`,
    [requestId, studentId, new Date(ended.getTime() - 10 * 60_000), helperId],
  );
  await rawPool().query(
    `INSERT INTO now.sessions (id, request_id, helper_id, student_id, solver_kind, livekit_room, accepted_at, helper_joined_at,
                               student_joined_at, started_at, ended_at, ended_by, outcome)
     VALUES ($1, $2, $3, $4, 'human', $5, $6, $6, $6, $6, $7, 'timer', 'resolved')`,
    [makeId("ses"), requestId, helperId, studentId, `now-${requestId}`, new Date(ended.getTime() - 6 * 60_000), ended],
  );
}

test("the chosen solver is asked first; a decline falls back to normal matching", { skip: NOW_SKIP }, async () => {
  await setup();
  for (const id of helpersMade) await clearPresence(id);
  const student = await seedStudent();
  const chosen = await seedHelper("physics");
  const favourite = await seedHelper("physics");
  await rawPool().query(`UPDATE now.helpers SET display_name = 'Asha' WHERE id = $1`, [chosen.helperId]);
  // Asha's chapter list does not include this question's chapter (Kinematics).
  await rawPool().query(`UPDATE now.helper_expertise SET chapter = 'Optics' WHERE helper_id = $1`, [chosen.helperId]);
  await pastSession(student, chosen.helperId);
  await pastSession(student, favourite.helperId);
  await setFavourite(student, favourite.helperId, true);
  await heartbeatHelper(chosen.userId, null);
  await heartbeatHelper(favourite.userId, null);

  const questionId = await seedAttemptedQuestion(student, "physics");
  const quote = await quoteLiveHelp(student, questionId);
  assert.deepEqual(
    quote.mySolvers.map((m) => [m.helperId, m.favourite, m.online]),
    [
      [favourite.helperId, true, true],
      [chosen.helperId, false, true],
    ],
    "favourites first, both online",
  );

  const request = await createRequest(student, { questionId, preferredHelperId: chosen.helperId });
  assert.equal(request.status, "offered");
  const first = await getCurrentOffer(chosen.userId);
  assert.ok(first, "Asha gets the first offer despite the favourite and her chapter list");
  assert.equal(await getCurrentOffer(favourite.userId), null);
  assert.equal((await getRequestView(request.id, { viewerUserId: student })).askingFirst, "Asha");

  await respondToOffer(chosen.userId, first.offerId, "decline", "busy");
  assert.equal(await status(request.id), "offered");
  assert.ok(await getCurrentOffer(favourite.userId), "then the favourite is asked");
  assert.equal((await getRequestView(request.id, { viewerUserId: student })).askingFirst, null);

  await cancelRequest(student, request.id);
});

test("a solver the student never worked with cannot be chosen", { skip: NOW_SKIP }, async () => {
  await setup();
  const student = await seedStudent();
  const stranger = await seedHelper("physics");
  await heartbeatHelper(stranger.userId, null);
  const questionId = await seedAttemptedQuestion(student, "physics");
  assert.deepEqual((await quoteLiveHelp(student, questionId)).mySolvers, []);
  await assert.rejects(
    createRequest(student, { questionId, preferredHelperId: stranger.helperId }),
    (error: { code?: string; status?: number }) => error.code === "preferred_not_available" && error.status === 400,
  );
  const open = await rawPool().query(`SELECT count(*)::int AS n FROM now.requests WHERE student_id = $1`, [student]);
  assert.equal(open.rows[0].n, 0, "nothing was created and no coins were held");
});

test("any of the student's solvers can be asked first, not only the five on the card (review fix)", { skip: NOW_SKIP }, async () => {
  await setup();
  for (const id of helpersMade) await clearPresence(id);
  const student = await seedStudent();
  const solvers = [];
  for (let i = 0; i < 6; i += 1) {
    const s = await seedHelper("physics");
    await rawPool().query(`UPDATE now.helpers SET display_name = $2 WHERE id = $1`, [s.helperId, `Solver ${i}`]);
    await pastSession(student, s.helperId);
    solvers.push(s);
  }
  const questionId = await seedAttemptedQuestion(student, "physics");
  const card = (await quoteLiveHelp(student, questionId)).mySolvers.map((m) => m.helperId);
  assert.equal(card.length, 5, "the card shows five");
  const sixth = solvers.find((s) => !card.includes(s.helperId))!;
  await heartbeatHelper(sixth.userId, null);
  const request = await createRequest(student, { questionId, preferredHelperId: sixth.helperId });
  assert.ok(await getCurrentOffer(sixth.userId), "the sixth solver is still asked first");
  await cancelRequest(student, request.id);
});
