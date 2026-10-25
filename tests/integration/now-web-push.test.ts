/**
 * Web push for solver offers (decision B85) against a real Postgres with a
 * fake push service: subscribing, the VAPID token a push service would
 * check, a push on every offer, expired browsers removed, and the
 * background-tab heartbeat.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

import { importJWK, jwtVerify } from "jose";

import { cancelRequest, createRequest, getCurrentOffer, heartbeatHelper } from "@/server/now/dispatch-service";
import { clearPresence, listOnlineHelpers } from "@/server/now/now-realtime";
import { vapidJwk } from "@/server/now/web-push-rules";
import {
  __setWebPushFetchForTests,
  deleteWebPushSubscription,
  hasWebPushSubscription,
  saveWebPushSubscription,
  sendWebPushToUser,
  webPushPublicKey,
} from "@/server/now/web-push";

import { closePool, rawPool } from "./_db";
import { NOW_SKIP, cleanupNowFixtures, helpersMade, seedAttemptedQuestion, seedHelper, seedStudent, seedUser, setup } from "./_now";

const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const PUBLIC = publicKey.export({ format: "der", type: "spki" }).subarray(-65).toString("base64url");
const PRIVATE = privateKey.export({ format: "jwk" }).d!;
const ENDPOINT = (n: string) => `https://fcm.googleapis.com/fcm/send/test-${n}-${Math.random().toString(36).slice(2)}`;

type Call = { url: string; headers: Record<string, string> };
const calls: Call[] = [];
let nextStatus = 201;

test.before(() => {
  process.env.NOW_WEB_PUSH_PUBLIC_KEY = PUBLIC;
  process.env.NOW_WEB_PUSH_PRIVATE_KEY = PRIVATE;
  process.env.NOW_WEB_PUSH_SUBJECT = "mailto:test@example.com";
  __setWebPushFetchForTests(async (url, init) => {
    calls.push({ url, headers: init.headers as Record<string, string> });
    return new Response(null, { status: nextStatus });
  });
});

test.after(async () => {
  __setWebPushFetchForTests(null);
  delete process.env.NOW_WEB_PUSH_PUBLIC_KEY;
  delete process.env.NOW_WEB_PUSH_PRIVATE_KEY;
  delete process.env.NOW_WEB_PUSH_SUBJECT;
  if (!NOW_SKIP) await rawPool().query(`DELETE FROM now.push_subscriptions WHERE endpoint LIKE 'https://fcm.googleapis.com/fcm/send/test-%'`);
  await cleanupNowFixtures();
  await closePool();
});

test("a solver turns alerts on; each push carries a VAPID token the push service can verify", { skip: NOW_SKIP }, async () => {
  await setup();
  const solver = await seedHelper("physics");
  assert.equal(webPushPublicKey(), PUBLIC);
  assert.equal(await hasWebPushSubscription(solver.userId), false);

  const endpoint = ENDPOINT("a");
  await saveWebPushSubscription(solver.userId, { endpoint, keys: { p256dh: "p", auth: "a" } }, "Test browser");
  assert.equal(await hasWebPushSubscription(solver.userId), true);

  calls.length = 0;
  nextStatus = 201;
  const sent = await sendWebPushToUser(solver.userId, { ttlSeconds: 24 });
  assert.deepEqual(sent, { attempted: 1, delivered: 1, pruned: 0 });
  assert.equal(calls[0].url, endpoint);
  assert.equal(calls[0].headers.TTL, "24");
  assert.equal(calls[0].headers.Urgency, "high");
  const match = /^vapid t=([^,]+), k=(.+)$/.exec(calls[0].headers.Authorization);
  assert.ok(match, "VAPID Authorization header");
  assert.equal(match[2], PUBLIC);
  const key = await importJWK({ ...vapidJwk(PUBLIC, PRIVATE)!, d: undefined }, "ES256");
  const { payload } = await jwtVerify(match[1], key, { audience: "https://fcm.googleapis.com" });
  assert.equal(payload.sub, "mailto:test@example.com");
  assert.ok((payload.exp ?? 0) * 1000 > Date.now(), "not expired");

  // The push service says the browser is gone: the subscription is removed.
  nextStatus = 410;
  assert.deepEqual(await sendWebPushToUser(solver.userId, { ttlSeconds: 24 }), { attempted: 1, delivered: 0, pruned: 1 });
  assert.equal(await hasWebPushSubscription(solver.userId), false);
  nextStatus = 201;
});

test("only solvers, and only real push services, can subscribe", { skip: NOW_SKIP }, async () => {
  const student = await seedUser("Not A Solver");
  const solver = await seedHelper("physics");
  await assert.rejects(saveWebPushSubscription(student, { endpoint: ENDPOINT("b") }, null), (e: { code?: string }) => e.code === "not_a_solver");
  await assert.rejects(
    saveWebPushSubscription(solver.userId, { endpoint: "https://attacker.example.com/hook" }, null),
    (e: { code?: string }) => e.code === "bad_endpoint",
  );
  const endpoint = ENDPOINT("c");
  await saveWebPushSubscription(solver.userId, { endpoint }, null);
  await deleteWebPushSubscription(solver.userId, endpoint);
  assert.equal(await hasWebPushSubscription(solver.userId), false);
});

test("an offer sends one push to the solver's browser, valid for the offer window", { skip: NOW_SKIP }, async () => {
  await setup();
  for (const id of helpersMade) await clearPresence(id);
  const solver = await seedHelper("physics");
  await saveWebPushSubscription(solver.userId, { endpoint: ENDPOINT("d") }, null);
  await heartbeatHelper(solver.userId, null);
  const student = await seedStudent();
  calls.length = 0;
  const request = await createRequest(student, { questionId: await seedAttemptedQuestion(student, "physics") });
  assert.ok(await getCurrentOffer(solver.userId));
  assert.equal(calls.length, 1, "one alert");
  const ttl = Number(calls[0].headers.TTL);
  assert.ok(ttl > 0 && ttl <= 26, `TTL ${ttl} covers only the 25-second offer`);
  await cancelRequest(student, request.id);
});

test("a background heartbeat needs alerts on, and keeps the solver online 30 s longer", { skip: NOW_SKIP }, async () => {
  const solver = await seedHelper("physics");
  const t0 = new Date();
  await assert.rejects(heartbeatHelper(solver.userId, null, t0, { background: true }), (e: { code?: string }) => e.code === "alerts_off");
  await saveWebPushSubscription(solver.userId, { endpoint: ENDPOINT("e") }, null);
  await heartbeatHelper(solver.userId, null, t0, { background: true });
  const at = (ms: number) => listOnlineHelpers("physics", t0.getTime() + ms);
  assert.ok((await at(80_000)).has(solver.helperId), "still online 80 s after a background heartbeat");
  assert.ok(!(await at(95_000)).has(solver.helperId), "offline after 90 s");
  await heartbeatHelper(solver.userId, null, t0);
  assert.ok(!(await at(80_000)).has(solver.helperId), "a foreground heartbeat keeps the usual 60 s");
  await clearPresence(solver.helperId);
});
