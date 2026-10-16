/**
 * Origin bot solver against a real Postgres: when the bot is assigned, LiveKit
 * is asked to dispatch the Origin Voice agent into the session room with the
 * question and its stored solution; if LiveKit refuses, the request closes and
 * the coins come back; a subject with the bot switched off closes at once.
 * LiveKit is a fetch stub (no network).
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createRequest } from "@/server/now/dispatch-service";
import { getWalletBalance } from "@/server/now/ledger-store";
import { __setLiveKitFetchForTests } from "@/server/now/livekit";
import { clearPresence } from "@/server/now/now-realtime";
import { setSetting } from "@/server/platform-settings";

import { closePool, rawPool } from "./_db";
import {
  NOW_SKIP,
  WELCOME,
  assertLedgerBalanced,
  cleanupNowFixtures,
  helpersMade,
  seedAttemptedQuestion,
  seedStudent,
  setup,
  status,
} from "./_now";

type Call = { method: string; body: Record<string, unknown> };
const calls: Call[] = [];
let failDispatch = false;
const savedEnv = { ...process.env };

test.before(() => {
  process.env.LIVEKIT_URL = "wss://test.livekit.invalid";
  process.env.LIVEKIT_API_KEY = "APItest";
  process.env.LIVEKIT_API_SECRET = "integration-test-livekit-secret-32b!";
  __setLiveKitFetchForTests(async (url, init) => {
    const method = url.split("/").pop() ?? "";
    calls.push({ method, body: JSON.parse(String(init.body)) });
    if (method === "CreateDispatch" && failDispatch) return new Response("agent unavailable", { status: 503 });
    return new Response(JSON.stringify(method === "CreateDispatch" ? { id: `AD_${calls.length}` } : {}), { status: 200 });
  });
});

test.after(async () => {
  __setLiveKitFetchForTests(null);
  process.env = savedEnv;
  await cleanupNowFixtures();
  await closePool();
});

async function noHumansOnline() {
  for (const id of helpersMade) await clearPresence(id);
}

test("the bot is dispatched into the session room with the question and its solution", { skip: NOW_SKIP }, async () => {
  await setup();
  await noHumansOnline();
  failDispatch = false;
  const student = await seedStudent();
  const request = await createRequest(student, { questionId: await seedAttemptedQuestion(student, "chemistry"), language: "hindi" });
  assert.equal(request.status, "accepted");
  const sessionId = request.session!.id;

  const dispatch = calls.filter((c) => c.method === "CreateDispatch" && c.body.room === `now-${sessionId}`);
  assert.equal(dispatch.length, 1);
  assert.equal(dispatch[0].body.agent_name, "origin-voice-agent");
  const meta = JSON.parse(String(dispatch[0].body.metadata));
  assert.equal(meta.mode, "now_solver");
  assert.equal(meta.session_id, sessionId);
  assert.equal(meta.student_first_name, "Meera");
  assert.equal(meta.language, "hindi");
  assert.equal(meta.question.correct_option_index, 1);
  assert.equal(meta.question.explanation, "v^2/2g", "the stored solution goes to the bot");
  assert.ok(meta.minutes >= 1);

  const event = await rawPool().query(`SELECT payload FROM now.events WHERE session_id = $1 AND type = 'bot.dispatched'`, [sessionId]);
  assert.equal(event.rows.length, 1);
});

test("if LiveKit cannot send the bot, the request closes and the coins come back", { skip: NOW_SKIP }, async () => {
  await setup();
  await noHumansOnline();
  failDispatch = true;
  try {
    const student = await seedStudent();
    const request = await createRequest(student, { questionId: await seedAttemptedQuestion(student, "chemistry") });
    const sessionId = request.session?.id;
    assert.ok(sessionId);
    assert.equal(await status(request.id), "no_helper");
    const row = await rawPool().query(`SELECT closed_reason, closed_detail, held_coins FROM now.requests WHERE id = $1`, [request.id]);
    assert.deepEqual(row.rows[0], { closed_reason: "no_helper", closed_detail: "none_online", held_coins: 0 });
    assert.equal((await getWalletBalance(student)).available, WELCOME);
    assert.ok(calls.some((c) => c.method === "DeleteRoom" && c.body.room === `now-${sessionId}`), "the empty room is closed");
    const failed = await rawPool().query(`SELECT 1 FROM now.events WHERE session_id = $1 AND type = 'bot.dispatch_failed'`, [sessionId]);
    assert.equal(failed.rows.length, 1);
    await assertLedgerBalanced();
  } finally {
    failDispatch = false;
  }
});

test("a subject with the bot switched off closes at once when nobody is online", { skip: NOW_SKIP }, async () => {
  await setup();
  await noHumansOnline();
  await setSetting(
    "now_bot_rule",
    JSON.stringify({ enabled: true, whenNoneOnline: true, afterFailedOffers: 3, afterMs: 120_000, disabledSubjects: ["chemistry"] }),
    null,
  );
  const before = calls.length;
  const student = await seedStudent();
  const request = await createRequest(student, { questionId: await seedAttemptedQuestion(student, "chemistry") });
  assert.equal(request.status, "no_helper");
  assert.equal(request.closedDetail, "none_online");
  assert.equal((await getWalletBalance(student)).available, WELCOME);
  assert.equal(calls.slice(before).filter((c) => c.method === "CreateDispatch").length, 0);
});
