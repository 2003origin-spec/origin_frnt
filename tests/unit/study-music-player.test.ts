/**
 * Study Music website player — the pure reducer (src/lib/study-music-player.ts):
 * queue next / previous / wrap, holds (test, break) pause and resume, a manual
 * play during a hold drops it, link refresh once then an error, restore from
 * sessionStorage JSON (garbage included), the Pomodoro tie-in, where the player
 * shows, and the listening delta. V1/STUDY_MUSIC_PLAN.md §11.1.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  INITIAL_PLAYER_STATE,
  TRACK_LOAD_ERROR,
  availableMoods,
  focusPhaseActions,
  isMusicExamPath,
  isMusicHiddenPath,
  listenedDelta,
  parseFocusSettings,
  parseSaved,
  playerReducer,
  shouldPlay,
  toSaved,
  type PlayerAction,
  type PlayerState,
  type PlayerTrack,
} from "../../src/lib/study-music-player";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function track(n: number, mood: PlayerTrack["mood"], loopable = false): PlayerTrack {
  return {
    id: id(n),
    title: `Track ${n}`,
    artist: "Origin",
    mood,
    durationSeconds: 120,
    loopable,
    credit: { required: false, text: `Track ${n} by Origin`, licenceName: "Made by Origin", licenceUrl: "https://www.o3origin.com/", sourceUrl: "https://www.o3origin.com/" },
  };
}
const TRACKS = [track(1, "lofi"), track(2, "lofi"), track(3, "lofi"), track(4, "nature", true), track(5, "white_noise")];

function run(...actions: PlayerAction[]): PlayerState {
  return actions.reduce(playerReducer, playerReducer(INITIAL_PLAYER_STATE, { type: "loaded", tracks: TRACKS }));
}

test("loaded: picks the saved default mood if it has tracks, else the first mood with tracks", () => {
  assert.equal(playerReducer(INITIAL_PLAYER_STATE, { type: "loaded", tracks: TRACKS, defaultMood: "nature" }).mood, "nature");
  assert.equal(playerReducer(INITIAL_PLAYER_STATE, { type: "loaded", tracks: TRACKS, defaultMood: "instrumental" }).mood, "lofi");
  assert.equal(playerReducer(INITIAL_PLAYER_STATE, { type: "loaded", tracks: [track(9, "nature")] }).mood, "nature");
  assert.deepEqual(availableMoods(TRACKS), ["lofi", "nature", "white_noise"]);
});

test("play starts the mood's first track; next / previous wrap round inside the mood", () => {
  let s = run({ type: "play" });
  assert.equal(s.trackId, id(1));
  assert.equal(shouldPlay(s), true);
  s = playerReducer(s, { type: "next" });
  assert.equal(s.trackId, id(2));
  s = playerReducer(playerReducer(s, { type: "next" }), { type: "next" });
  assert.equal(s.trackId, id(1), "wraps from the last lofi track to the first");
  s = playerReducer(s, { type: "previous" });
  assert.equal(s.trackId, id(3), "previous wraps backwards");
  assert.equal(shouldPlay(s), true, "changing track keeps playing");
});

test("ended: next track, or the same one again when it loops", () => {
  let s = run({ type: "play" }, { type: "ended" });
  assert.equal(s.trackId, id(2));
  s = run({ type: "setMood", mood: "nature" }, { type: "play" }, { type: "ended" });
  assert.equal(s.trackId, id(4), "a loopable track stays");
});

test("mood change: cues the mood's first track and keeps the play state", () => {
  const playing = run({ type: "play" }, { type: "setMood", mood: "white_noise" });
  assert.equal(playing.trackId, id(5));
  assert.equal(shouldPlay(playing), true);
  const paused = run({ type: "setMood", mood: "white_noise" });
  assert.equal(paused.trackId, id(5));
  assert.equal(shouldPlay(paused), false);
});

test("holds: a test or a break pauses; the music returns when the LAST hold goes", () => {
  let s = run({ type: "play" }, { type: "hold", kind: "test" });
  assert.equal(shouldPlay(s), false);
  s = playerReducer(s, { type: "hold", kind: "break" });
  s = playerReducer(s, { type: "release", kind: "test" });
  assert.equal(shouldPlay(s), false, "still held by the break");
  s = playerReducer(s, { type: "release", kind: "break" });
  assert.equal(shouldPlay(s), true, "resumes by itself");
  assert.deepEqual(playerReducer(s, { type: "release", kind: "test" }), s, "releasing an absent hold changes nothing");
});

test("holds: a manual pause during a hold wins (no auto-resume); a manual play drops every hold", () => {
  const paused = run({ type: "play" }, { type: "hold", kind: "test" }, { type: "pause" }, { type: "release", kind: "test" });
  assert.equal(shouldPlay(paused), false, "the student paused: nothing auto-resumes");
  const played = run({ type: "play" }, { type: "hold", kind: "test" }, { type: "play" });
  assert.deepEqual(played.holds, []);
  assert.equal(shouldPlay(played), true, "their choice wins");
  const toggled = run({ type: "play" }, { type: "hold", kind: "break" }, { type: "toggle" });
  assert.equal(shouldPlay(toggled), true, "the mini player's button is a play press too");
  // A hold on paused music never starts it.
  assert.equal(shouldPlay(run({ type: "hold", kind: "test" }, { type: "release", kind: "test" })), false);
});

test("link refresh: the first load error renews the link once; a second error shows the message", () => {
  let s = run({ type: "play" }, { type: "loadError" });
  assert.equal(s.refreshing, true);
  assert.equal(s.error, null);
  s = playerReducer(s, { type: "refreshed" });
  assert.equal(s.refreshing, false);
  s = playerReducer(s, { type: "loadError" });
  assert.equal(s.error, TRACK_LOAD_ERROR);
  assert.equal(shouldPlay(s), false);
  // A successful start resets the "once" budget for the next failure.
  const ok = run({ type: "play" }, { type: "loadError" }, { type: "refreshed" }, { type: "playing" }, { type: "loadError" });
  assert.equal(ok.refreshing, true);
  assert.equal(ok.error, null);
  // Pressing play after the error tries again.
  assert.equal(playerReducer(s, { type: "play" }).error, null);
});

test("autoplay blocked after a reload: needsGesture until the student presses play", () => {
  const blocked = run({ type: "play" }, { type: "autoplayBlocked" });
  assert.equal(blocked.needsGesture, true);
  assert.equal(playerReducer(blocked, { type: "play" }).needsGesture, false);
  assert.equal(playerReducer(blocked, { type: "playing" }).needsGesture, false);
});

test("a retired track disappearing from the list stops the music", () => {
  const s = run({ type: "play" });
  const after = playerReducer(s, { type: "loaded", tracks: TRACKS.slice(1) });
  assert.equal(after.trackId, null);
  assert.equal(shouldPlay(after), false);
});

test("sessionStorage: what toSaved writes restores; garbage never throws", () => {
  const s = run({ type: "play" }, { type: "next" });
  const saved = toSaved(s, 42.37);
  assert.deepEqual(saved, { trackId: id(2), position: 42.3, wasPlaying: true, heldForTest: false, mood: "lofi" });
  const parsed = parseSaved(JSON.stringify(saved));
  assert.deepEqual(parsed, saved);
  const restored = playerReducer(run(), { type: "restore", saved: parsed!, onTestPage: false });
  assert.equal(restored.trackId, id(2));
  assert.equal(restored.resumeAt, 42.3);
  assert.equal(shouldPlay(restored), true);
  assert.equal(playerReducer(restored, { type: "positionUsed" }).resumeAt, 0);

  for (const garbage of [null, "", "{", "null", "[]", "42", '"x"', '{"trackId":"../x","mood":"lofi","wasPlaying":true,"heldForTest":false}',
    `{"trackId":"${id(1)}","mood":"jazz","wasPlaying":true,"heldForTest":false}`, `{"trackId":"${id(1)}","mood":"lofi","wasPlaying":"yes","heldForTest":false}`,
    "x".repeat(5000)]) {
    assert.equal(parseSaved(garbage), null, String(garbage).slice(0, 40));
  }
  const badPosition = parseSaved(`{"trackId":"${id(1)}","mood":"lofi","wasPlaying":false,"heldForTest":false,"position":-5}`);
  assert.equal(badPosition?.position, 0);
  // A saved id that no longer exists is ignored.
  const unknown = { ...saved!, trackId: id(99) };
  assert.deepEqual(playerReducer(run(), { type: "restore", saved: unknown, onTestPage: false }), run());
  assert.equal(toSaved(run(), 10), null, "nothing chosen → nothing saved");
});

test("restore: a test hold survives a reload only back on a test page", () => {
  const held = toSaved(run({ type: "play" }, { type: "hold", kind: "test" }), 5)!;
  assert.equal(held.heldForTest, true);
  assert.equal(held.wasPlaying, false);
  const onTest = playerReducer(run(), { type: "restore", saved: held, onTestPage: true });
  assert.deepEqual(onTest.holds, ["test"]);
  assert.equal(shouldPlay(onTest), false);
  const elsewhere = playerReducer(run(), { type: "restore", saved: held, onTestPage: false });
  assert.deepEqual(elsewhere.holds, []);
  assert.equal(shouldPlay(elsewhere), true, "never held for ever on a normal page");
});

test("Pomodoro tie-in: start with focus, stop at breaks, idle drops the break hold", () => {
  const on = { startWithFocus: true, stopAtBreaks: true };
  assert.deepEqual(focusPhaseActions("idle", "focus", on, false), [{ type: "release", kind: "break" }, { type: "play" }]);
  assert.deepEqual(focusPhaseActions("idle", "focus", on, true), [{ type: "release", kind: "break" }], "already playing");
  assert.deepEqual(focusPhaseActions("idle", "focus", { ...on, startWithFocus: false }, false), [{ type: "release", kind: "break" }]);
  assert.deepEqual(focusPhaseActions("focus", "break", on, true), [{ type: "hold", kind: "break" }]);
  assert.deepEqual(focusPhaseActions("focus", "break", { ...on, stopAtBreaks: false }, true), []);
  assert.deepEqual(focusPhaseActions("break", "idle", on, false), [{ type: "release", kind: "break" }]);
  assert.deepEqual(focusPhaseActions("focus", "focus", on, false), []);
  // Full cycle through the reducer: focus plays, break holds, next focus resumes.
  let s = run();
  for (const a of focusPhaseActions("idle", "focus", on, shouldPlay(s))) s = playerReducer(s, a);
  assert.equal(shouldPlay(s), true);
  for (const a of focusPhaseActions("focus", "break", on, shouldPlay(s))) s = playerReducer(s, a);
  assert.equal(shouldPlay(s), false);
  for (const a of focusPhaseActions("break", "focus", on, shouldPlay(s))) s = playerReducer(s, a);
  assert.equal(shouldPlay(s), true);
  assert.deepEqual(parseFocusSettings("{bad"), { startWithFocus: false, stopAtBreaks: true });
  assert.deepEqual(parseFocusSettings('{"startWithFocus":true,"stopAtBreaks":"no"}'), { startWithFocus: true, stopAtBreaks: true });
});

test("where the player shows: exam pages get the small button; admin / teacher / signed-out none", () => {
  for (const p of ["/tests/abc", "/tests/abc/attempt", "/study-rooms/r1/test", "/cbt", "/cbt/room/1", "/contest/c1/play"]) {
    assert.equal(isMusicExamPath(p), true, p);
  }
  for (const p of ["/tests", "/tests/abc/result", "/dashboard", "/pomodoro", "/contest/c1", "/study-rooms/r1"]) {
    assert.equal(isMusicExamPath(p), false, p);
  }
  for (const p of ["/admin", "/admin/music", "/teacher", "/teacher/workspaces/1", "/", "/auth", "/onboarding"]) {
    assert.equal(isMusicHiddenPath(p), true, p);
  }
  assert.equal(isMusicHiddenPath("/dashboard"), false);
  assert.equal(isMusicHiddenPath("/administrator"), false);
});

test("listening delta: forward and small only (a seek or a stall is not listening)", () => {
  assert.equal(listenedDelta(10, 10.25), 0.25);
  assert.equal(listenedDelta(10, 9), 0, "seek back");
  assert.equal(listenedDelta(10, 40), 0, "seek forward");
  assert.equal(listenedDelta(10, 10), 0);
});
