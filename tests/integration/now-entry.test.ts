/**
 * The "Need human help" quote against a real Postgres: hidden outside the
 * cohort, "attempt first" before an attempt, the human or bot price depending
 * on who is online, "Buy coins" when the balance is short, and the open
 * request when there is one.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createRequest, heartbeatHelper, quoteLiveHelp } from "@/server/now/dispatch-service";
import { clearPresence } from "@/server/now/now-realtime";
import { getOgcodeCatalogCounts } from "@/server/ogcode-catalog";
import { savePriceTable } from "@/server/now/admin-store";
import { DEFAULT_PRICE_TABLE } from "@/server/now/pricing";

import { closePool, makeId, rawPool } from "./_db";
import { EASY_HUMAN, NOW_SKIP, WELCOME, cleanupNowFixtures, helpersMade, questionsMade, seedAttemptedQuestion, seedHelper, seedStudent, seedUser, setup } from "./_now";

test.after(async () => {
  await cleanupNowFixtures();
  await closePool();
});

test("the quote behind the Need human help button", { skip: NOW_SKIP }, async () => {
  await setup();
  for (const id of helpersMade) await clearPresence(id);
  const student = await seedStudent();
  const attempted = await seedAttemptedQuestion(student, "physics");

  // Not in the pilot: nothing to show.
  const outsider = await seedUser("Not Invited");
  const hidden = await quoteLiveHelp(outsider, attempted);
  assert.equal(hidden.available, false);
  assert.equal(hidden.blockedReason, "not_invited");

  // Not attempted yet.
  await getOgcodeCatalogCounts();
  const fresh = makeId("q");
  questionsMade.push(fresh);
  await rawPool().query(
    `INSERT INTO ogcode_questions (id, source_index, text, options, correct_option, explanation, subject, chapter, concept, difficulty, question_type)
     VALUES ($1, $2, 'Fresh', $3::jsonb, 0, 'x', 'physics', 'Kinematics', 'Projectile', 'Easy', 'mcq')`,
    [fresh, 200_000 + Math.floor(Math.random() * 90_000), JSON.stringify(["A", "B"])],
  );
  const notYet = await quoteLiveHelp(student, fresh);
  assert.equal(notYet.available, false);
  assert.equal(notYet.blockedReason, "attempt_first");

  // Nobody online: the bot price (same as human by default), coins enough.
  const botQuote = await quoteLiveHelp(student, attempted);
  assert.equal(botQuote.available, true);
  assert.equal(botQuote.humansLikely, false);
  assert.equal(botQuote.botOn, true);
  assert.equal(botQuote.priceCoins, EASY_HUMAN);
  assert.equal(botQuote.balance, WELCOME, "the quote grants the welcome coins on first sight");
  assert.equal(botQuote.canAfford, true);

  // A human online in open hours: humans likely.
  const solver = await seedHelper("physics");
  await heartbeatHelper(solver.userId, null);
  assert.equal((await quoteLiveHelp(student, attempted)).humansLikely, true);

  // Short of coins → canAfford false (the button reads "Buy coins").
  const admin = await seedUser("Price Admin");
  const table = DEFAULT_PRICE_TABLE.map((r) => (r.difficulty === "easy" ? { ...r, priceCoins: WELCOME + 1 } : r));
  await savePriceTable(table, admin);
  const short = await quoteLiveHelp(student, attempted);
  assert.equal(short.priceCoins, WELCOME + 1);
  assert.equal(short.canAfford, false);
  await rawPool().query(`DELETE FROM now.prices`);

  // An open request is surfaced so the button opens it instead of asking again.
  const request = await createRequest(student, { questionId: attempted });
  assert.equal((await quoteLiveHelp(student, attempted)).openRequestId, request.id);
  await clearPresence(solver.helperId);
});
