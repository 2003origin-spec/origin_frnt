/**
 * Offer alerts in the Android app (decision B88) against a real Postgres:
 * a solver whose phone is registered for push may stay online from the
 * background, like a browser with offer alerts (B85), but only while the
 * server can actually send FCM messages.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { canAlertInBackground, heartbeatHelper } from "@/server/now/dispatch-service";
import { clearPresence } from "@/server/now/now-realtime";
import { registerDeviceToken, revokeDeviceToken } from "@/server/push/device-tokens";

import { closePool, rawPool } from "./_db";
import { NOW_SKIP, cleanupNowFixtures, helpersMade, seedHelper, setup } from "./_now";

const FCM_ENV = ["FCM_PROJECT_ID", "FCM_CLIENT_EMAIL", "FCM_PRIVATE_KEY"] as const;
const saved = Object.fromEntries(FCM_ENV.map((k) => [k, process.env[k]]));
const tokens: string[] = [];

function setFcm(on: boolean) {
  for (const key of FCM_ENV) {
    if (on) process.env[key] = `test-${key}`;
    else delete process.env[key];
  }
}

test.after(async () => {
  for (const key of FCM_ENV) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  if (!NOW_SKIP && tokens.length > 0) await rawPool().query(`DELETE FROM notif.device_tokens WHERE token = ANY($1::text[])`, [tokens]);
  await cleanupNowFixtures();
  await closePool();
});

const alertsOff = (e: { code?: string }) => e.code === "alerts_off";

test("a solver's registered phone lets the shift run in the background, only while FCM is set up", { skip: NOW_SKIP }, async () => {
  await setup();
  for (const id of helpersMade) await clearPresence(id);
  const solver = await seedHelper("physics");
  setFcm(true);
  try {
    assert.equal(await canAlertInBackground(solver.userId), false, "no browser alerts and no phone yet");
    await assert.rejects(heartbeatHelper(solver.userId, null, new Date(), { background: true }), alertsOff);

    const token = `fcm-test-${Math.random().toString(36).slice(2)}-${"x".repeat(20)}`;
    tokens.push(token);
    await registerDeviceToken({ userId: solver.userId, token, platform: "android", appVersionCode: 10003 });
    assert.equal(await canAlertInBackground(solver.userId), true);
    await heartbeatHelper(solver.userId, null, new Date(), { background: true });

    setFcm(false);
    assert.equal(await canAlertInBackground(solver.userId), false, "a phone is no use while the server cannot send FCM");
    await assert.rejects(heartbeatHelper(solver.userId, null, new Date(), { background: true }), alertsOff);

    setFcm(true);
    await revokeDeviceToken(token);
    assert.equal(await canAlertInBackground(solver.userId), false, "signed out on the phone");
  } finally {
    setFcm(false);
    await clearPresence(solver.helperId);
  }
});
