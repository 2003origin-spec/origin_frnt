/**
 * Exam timers run on the server's clock, not the device's: a phone set ten
 * minutes fast must not auto-submit a room test ten minutes early.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  betterSkew,
  computeRemainingSeconds,
  estimateClockSkewMs,
  MAX_RENDER_SKEW_MS,
  provisionalSkewFromRender,
  serverNowFrom,
  skewFromRoundTrip,
} from "@/lib/server-clock";

const T0 = Date.parse("2026-10-22T10:00:00Z");

test("skew from a rendered server timestamp is client − server", () => {
  assert.equal(estimateClockSkewMs({ clientNowMs: T0 + 600_000, serverNowMs: T0 }), 600_000);
  assert.equal(estimateClockSkewMs({ clientNowMs: T0 - 5_000, serverNowMs: T0 }), -5_000);
  assert.equal(estimateClockSkewMs({ clientNowMs: T0, serverNowMs: Number.NaN }), 0);
});

test("skew from a fetch uses the round-trip midpoint", () => {
  // Sent at T0, answered 400ms later; server read its clock at T0+200 (client time) = server T0+200-600000.
  assert.equal(estimateClockSkewMs({ sentAtMs: T0, clientNowMs: T0 + 400, serverNowMs: T0 + 200 - 600_000 }), 600_000);
});

test("a fast device clock does not shorten a room test", () => {
  const source = { startedAt: new Date(T0).toISOString(), durationSeconds: 1800 };
  const fastClient = T0 + 600_000; // device 10 min fast, real time = start
  assert.equal(computeRemainingSeconds({ ...source, skewMs: 0 }, fastClient), 1200, "uncorrected: 10 min lost");
  const skewMs = estimateClockSkewMs({ clientNowMs: fastClient, serverNowMs: T0 });
  assert.equal(computeRemainingSeconds({ ...source, skewMs }, fastClient), 1800);
  assert.equal(serverNowFrom(skewMs, fastClient), T0);
});

test("remaining never goes negative", () => {
  const source = { startedAt: new Date(T0).toISOString(), durationSeconds: 60, skewMs: 0 };
  assert.equal(computeRemainingSeconds(source, T0 + 3_600_000), 0);
});

test("a cached page render can't push the room clock minutes behind", () => {
  // Rendered 7 minutes ago (SW cache / back-forward cache), device clock correct.
  const clientNow = T0;
  const staleRender = T0 - 7 * 60_000;
  assert.equal(estimateClockSkewMs({ clientNowMs: clientNow, serverNowMs: staleRender }), 420_000, "raw: 7 min late");
  assert.equal(provisionalSkewFromRender({ clientNowMs: clientNow, serverNowMs: staleRender }), 0);
  // A small, plausible offset is still used until the live measurement lands.
  assert.equal(provisionalSkewFromRender({ clientNowMs: T0 + 2_000, serverNowMs: T0 }), 2_000);
  assert.equal(provisionalSkewFromRender({ clientNowMs: T0 - MAX_RENDER_SKEW_MS - 1, serverNowMs: T0 }), 0);
});

test("a live round trip measures a real fast clock, with its uncertainty", () => {
  // Device 10 min fast; request took 800ms; server read its clock mid-way.
  const sent = T0 + 600_000;
  const m = skewFromRoundTrip({ sentAtMs: sent, receivedAtMs: sent + 800, serverNowMs: T0 + 400 });
  assert.deepEqual(m, { skewMs: 600_000, uncertaintyMs: 400 });
  assert.equal(skewFromRoundTrip({ sentAtMs: sent, receivedAtMs: sent - 1, serverNowMs: T0 }), null);
  assert.equal(skewFromRoundTrip({ sentAtMs: sent, receivedAtMs: sent + 1, serverNowMs: undefined }), null);
  assert.equal(skewFromRoundTrip({ sentAtMs: sent, receivedAtMs: sent + 1, serverNowMs: "1" }), null);
});

test("the tighter measurement wins", () => {
  const slow = { skewMs: 5_000, uncertaintyMs: 3_000 };
  const fast = { skewMs: 6_000, uncertaintyMs: 100 };
  assert.equal(betterSkew(null, slow), slow);
  assert.equal(betterSkew(slow, fast), fast);
  assert.equal(betterSkew(fast, slow), fast);
  assert.equal(betterSkew(fast, null), fast);
});
