/**
 * BoomBoom website sleep timer (src/lib/study-music-sleep.ts): presets, the
 * 5-second fade, stop at the end time, "end of this track", the label, and the
 * saved value read back from sessionStorage (garbage, expired and too-long ones
 * are dropped).
 */

import test from "node:test";
import assert from "node:assert/strict";

import { SLEEP_FADE_MS, checkSleep, parseSleep, sleepLabel, startSleep } from "../../src/lib/study-music-sleep";

const NOW = 1_700_000_000_000;

test("startSleep: minutes from now, end of track, or off", () => {
  assert.deepEqual(startSleep(15, NOW), { kind: "at", endsAt: NOW + 15 * 60_000 });
  assert.deepEqual(startSleep(0, NOW), { kind: "at", endsAt: NOW + 60_000 });
  assert.deepEqual(startSleep("endOfTrack", NOW), { kind: "endOfTrack" });
  assert.equal(startSleep(null, NOW), null);
});

test("checkSleep: full volume, then a 5 s fade, then stop (also after a clock jump past the end)", () => {
  const timer = startSleep(15, NOW);
  assert.deepEqual(checkSleep(timer, NOW), { stop: false, volume: 1 });
  assert.deepEqual(checkSleep(timer, NOW + 15 * 60_000 - SLEEP_FADE_MS - 1), { stop: false, volume: 1 });
  const half = checkSleep(timer, NOW + 15 * 60_000 - SLEEP_FADE_MS / 2);
  assert.equal(half.stop, false);
  assert.ok(Math.abs(half.volume - 0.5) < 1e-9);
  assert.deepEqual(checkSleep(timer, NOW + 15 * 60_000), { stop: true, volume: 0 });
  assert.deepEqual(checkSleep(timer, NOW + 3 * 60 * 60_000), { stop: true, volume: 0 });
  assert.deepEqual(checkSleep(null, NOW), { stop: false, volume: 1 });
  assert.deepEqual(checkSleep({ kind: "endOfTrack" }, NOW), { stop: false, volume: 1 });
});

test("sleepLabel: minutes left rounded up, end of track, off", () => {
  assert.equal(sleepLabel(startSleep(30, NOW), NOW), "Stops in 30 min");
  assert.equal(sleepLabel(startSleep(30, NOW), NOW + 29 * 60_000 + 1), "Stops in 1 min");
  assert.equal(sleepLabel({ kind: "endOfTrack" }, NOW), "Stops at the end of this track");
  assert.equal(sleepLabel(null, NOW), null);
});

test("parseSleep: restores a live timer; drops garbage, expired and impossible ones", () => {
  assert.deepEqual(parseSleep(JSON.stringify({ kind: "at", endsAt: NOW + 60_000 }), NOW), { kind: "at", endsAt: NOW + 60_000 });
  assert.deepEqual(parseSleep(JSON.stringify({ kind: "endOfTrack" }), NOW), { kind: "endOfTrack" });
  assert.equal(parseSleep(JSON.stringify({ kind: "at", endsAt: NOW - 1 }), NOW), null);
  assert.equal(parseSleep(JSON.stringify({ kind: "at", endsAt: NOW + 5 * 60 * 60_000 }), NOW), null);
  assert.equal(parseSleep(JSON.stringify({ kind: "at", endsAt: "soon" }), NOW), null);
  assert.equal(parseSleep("{not json", NOW), null);
  assert.equal(parseSleep(null, NOW), null);
});
