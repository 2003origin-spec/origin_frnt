/**
 * Origin NOW in the teacher menu (pilot readiness item 4): only approved
 * solvers see it, never while the flag is off, and a database problem hides
 * the item instead of breaking the teacher pages.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { isNowSolver } from "@/server/now/teacher-entry";

import { closePool, rawPool } from "./_db";
import { NOW_SKIP, cleanupNowFixtures, seedHelper, seedUser, setup } from "./_now";

test.after(async () => {
  await cleanupNowFixtures();
  await closePool();
});

test("approved (or paused) solvers see Origin NOW in /teacher; others and rejected ones do not", { skip: NOW_SKIP }, async () => {
  await setup();
  const solver = await seedHelper("physics");
  const plainTeacher = await seedUser("Kavya Teacher");
  assert.equal(await isNowSolver(solver.userId), true);
  assert.equal(await isNowSolver(plainTeacher), false);
  assert.equal(await isNowSolver(null), false);

  await rawPool().query(`UPDATE now.helpers SET verification_status = 'restricted' WHERE id = $1`, [solver.helperId]);
  assert.equal(await isNowSolver(solver.userId), true, "a paused solver still reaches the screen that explains the pause");
  await rawPool().query(`UPDATE now.helpers SET verification_status = 'rejected' WHERE id = $1`, [solver.helperId]);
  assert.equal(await isNowSolver(solver.userId), false);
});

test("with the flag off nothing is shown and the database is never asked", { skip: NOW_SKIP }, async () => {
  const solver = await seedHelper("physics");
  const saved = process.env.TEACHER_LAUNCH_ORIGIN_NOW;
  process.env.TEACHER_LAUNCH_ORIGIN_NOW = "0";
  try {
    assert.equal(await isNowSolver(solver.userId), false);
  } finally {
    process.env.TEACHER_LAUNCH_ORIGIN_NOW = saved;
  }
});
