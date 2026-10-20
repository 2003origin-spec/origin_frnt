/**
 * Shared Origin NOW fixtures for DB integration tests: pilot settings, a
 * cohort student, a verified human solver, an attempted OGCode question, and
 * the clean-up other suites rely on (they sample the question bank).
 */

import assert from "node:assert/strict";

import { createRequest, getCurrentOffer, heartbeatHelper, respondToOffer } from "@/server/now/dispatch-service";
import { findUnbalancedTransfers } from "@/server/now/ledger-rules";
import { loadAllLegsForAudit } from "@/server/now/ledger-store";
import { clearPresence } from "@/server/now/now-realtime";
import { ensureNowSchema } from "@/server/now/now-schema";
import { getOgcodeCatalogCounts } from "@/server/ogcode-catalog";
import { getOgcodeQuestionProgress } from "@/server/ogcode-progress";
import { setSetting } from "@/server/platform-settings";

import { dbConfigured, makeId, rawPool } from "./_db";

export const NOW_SKIP = !dbConfigured() || !process.env.OGCODE_DATABASE_URL;
export const WELCOME = 200;
export const EASY_HUMAN = 40; // DEFAULT_PRICE_TABLE placeholders
export const EASY_EXTENSION = 20;

export const helpersMade: string[] = [];
export const questionsMade: string[] = [];

export async function setup(): Promise<void> {
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
  // The parts after the pilot scope (B88–B95) start off; a test switches on what it needs.
  await setSetting("now_features", "{}", null);
  // A request an earlier test left waiting would be offered to this test's
  // fresh solver on its first heartbeat (correct behaviour, wrong test), so
  // every test starts with nothing waiting.
  await rawPool().query(
    `UPDATE now.offers SET response = 'expired', responded_at = NOW()
      WHERE response IS NULL AND request_id IN (SELECT id FROM now.requests WHERE status IN ('requested', 'offered'))`,
  );
  await rawPool().query(
    `UPDATE now.requests SET status = 'cancelled', closed_reason = 'cancelled', closed_at = NOW(), current_offer_id = NULL
      WHERE status IN ('requested', 'offered')`,
  );
}

export async function seedUser(name: string): Promise<string> {
  const id = makeId("now_user");
  await rawPool().query(
    `INSERT INTO origin_users (id, name, email, role, password_hash, date_of_birth) VALUES ($1, $2, $3, 'student', 'x', '1995-01-01')`,
    [id, name, `${id}@example.com`],
  );
  return id;
}

export async function seedStudent(): Promise<string> {
  const id = await seedUser("Meera Iyer");
  await rawPool().query(`INSERT INTO now.pilot_cohort (user_id, invited_by) VALUES ($1, NULL)`, [id]);
  return id;
}

export async function seedHelper(subject: string): Promise<{ userId: string; helperId: string }> {
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

export async function seedAttemptedQuestion(studentId: string, subject: string): Promise<string> {
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

/** A fresh student and physics solver with an accepted human session between them. */
export async function acceptedHumanSession(): Promise<{
  student: string;
  solver: { userId: string; helperId: string };
  requestId: string;
  sessionId: string;
}> {
  await setup();
  for (const id of helpersMade) await clearPresence(id); // earlier tests' solvers must not take the offer
  const student = await seedStudent();
  const solver = await seedHelper("physics");
  await heartbeatHelper(solver.userId, null);
  const request = await createRequest(student, { questionId: await seedAttemptedQuestion(student, "physics") });
  const offer = (await getCurrentOffer(solver.userId))!;
  const { sessionId } = await respondToOffer(solver.userId, offer.offerId, "accept", null);
  return { student, solver, requestId: request.id, sessionId: sessionId! };
}

/** Switches on some of the parts after the pilot scope (Settings → Extra parts). */
export async function setFeatures(on: Partial<Record<"board" | "askLater" | "groups" | "merch" | "rupeePrices", boolean>>): Promise<void> {
  await setSetting("now_features", JSON.stringify(on), null);
}

export async function status(requestId: string): Promise<string> {
  const res = await rawPool().query<{ status: string }>(`SELECT status FROM now.requests WHERE id = $1`, [requestId]);
  return res.rows[0].status;
}

export async function sessionOf(requestId: string) {
  const res = await rawPool().query(`SELECT * FROM now.sessions WHERE request_id = $1 ORDER BY accepted_at DESC LIMIT 1`, [requestId]);
  return res.rows[0];
}

export async function accountBalance(account: string): Promise<number> {
  const res = await rawPool().query<{ n: number }>(
    `SELECT COALESCE(sum(CASE WHEN direction = 'credit' THEN amount ELSE -amount END), 0)::int AS n
       FROM now.ledger_entries WHERE account_id = $1`,
    [account],
  );
  return res.rows[0].n;
}

export async function assertLedgerBalanced(): Promise<void> {
  assert.deepEqual(findUnbalancedTransfers(await loadAllLegsForAudit()), []);
}

export async function cleanupNowFixtures(): Promise<void> {
  for (const id of helpersMade) await clearPresence(id);
  if (dbConfigured() && questionsMade.length) {
    await rawPool().query(`DELETE FROM ogcode_question_progress WHERE question_id = ANY($1::text[])`, [questionsMade]);
    await rawPool().query(`DELETE FROM ogcode_questions WHERE id = ANY($1::text[])`, [questionsMade]);
  }
}
