/**
 * Study Music pure rules (src/lib/study-music.ts): moods, text lengths,
 * duration and size limits, the upload type allowlist, the sha256 shape,
 * magic bytes, prefs and listening heartbeats. V1/STUDY_MUSIC_PLAN.md §11.1.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  MUSIC_AUDIO_MAX_BYTES,
  MUSIC_MOODS,
  formatMusicToday,
  isMusicMood,
  isSha256Hex,
  looksLikeAudio,
  looksLikeProof,
  parseListenInput,
  parsePrefsInput,
  parsePresignInput,
  parseTrackFields,
} from "../../src/lib/study-music";

const SHA = "a".repeat(64);
const GOOD = {
  title: "Winter Lofi",
  artist: "HoliznaCC0",
  mood: "lofi",
  durationSeconds: 180,
  sourceUrl: "https://freemusicarchive.org/music/holiznacc0/",
  licenceName: "CC0 1.0",
  licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  attributionRequired: false,
  attributionText: "‘Winter Lofi’ by HoliznaCC0, CC0",
};

const fieldError = (patch: Record<string, unknown>) => {
  const r = parseTrackFields({ ...GOOD, ...patch });
  return r.ok ? null : r.error;
};

test("moods: exactly the four, nothing else", () => {
  assert.deepEqual([...MUSIC_MOODS], ["lofi", "instrumental", "nature", "white_noise"]);
  for (const m of MUSIC_MOODS) assert.equal(isMusicMood(m), true);
  for (const m of ["Lofi", "jazz", "", null, 1, "white noise"]) assert.equal(isMusicMood(m), false, String(m));
  assert.match(fieldError({ mood: "jazz" }) ?? "", /mood/i);
});

test("a complete track parses, with defaults for the optional flags", () => {
  const r = parseTrackFields(GOOD);
  assert.ok(r.ok);
  assert.equal(r.value.loopable, false);
  assert.equal(r.value.allowOffline, true);
  assert.equal(r.value.sortOrder, 0);
  assert.equal(r.value.title, "Winter Lofi");
});

test("title and artist: 1–80 characters (code points), trimmed, one line", () => {
  assert.equal(fieldError({ title: "x".repeat(80) }), null);
  assert.match(fieldError({ title: "x".repeat(81) }) ?? "", /Title/);
  assert.match(fieldError({ title: "   " }) ?? "", /Title/);
  assert.match(fieldError({ title: "two\nlines" }) ?? "", /Title/);
  // 80 emoji = 80 code points (160 UTF-16 units): allowed, like char_length.
  assert.equal(fieldError({ title: "🎵".repeat(80) }), null);
  assert.match(fieldError({ artist: "" }) ?? "", /Artist/);
  assert.match(fieldError({ artist: "y".repeat(81) }) ?? "", /Artist/);
  const trimmed = parseTrackFields({ ...GOOD, title: "  Rain  " });
  assert.ok(trimmed.ok && trimmed.value.title === "Rain");
});

test("duration: 19 rejected, 20 and 1200 accepted, 1201 rejected, whole numbers only", () => {
  assert.match(fieldError({ durationSeconds: 19 }) ?? "", /20 seconds/);
  assert.equal(fieldError({ durationSeconds: 20 }), null);
  assert.equal(fieldError({ durationSeconds: 1200 }), null);
  assert.ok(fieldError({ durationSeconds: 1201 }));
  assert.ok(fieldError({ durationSeconds: 60.5 }));
  assert.ok(fieldError({ durationSeconds: "60" }));
});

test("presign: audio type allowlist and size 1 byte to 15 MB", () => {
  const ok = parsePresignInput({ kind: "audio", contentType: "audio/mp4", size: 1000 });
  assert.ok(ok.ok);
  assert.ok(parsePresignInput({ kind: "audio", contentType: "audio/mpeg", size: MUSIC_AUDIO_MAX_BYTES }).ok);
  for (const contentType of ["audio/ogg", "audio/mp4; codecs=mp4a.40.2", "text/html", "audio/wav", "", "video/mp4"]) {
    assert.equal(parsePresignInput({ kind: "audio", contentType, size: 1000 }).ok, false, contentType);
  }
  assert.equal(parsePresignInput({ kind: "audio", contentType: "audio/mp4", size: 0 }).ok, false);
  assert.equal(parsePresignInput({ kind: "audio", contentType: "audio/mp4", size: MUSIC_AUDIO_MAX_BYTES + 1 }).ok, false);
  assert.equal(parsePresignInput({ kind: "audio", contentType: "audio/mp4", size: "1000" }).ok, false);
  assert.equal(parsePresignInput({ kind: "video", contentType: "audio/mp4", size: 1000 }).ok, false);
});

test("presign: proof is PDF / PNG / JPEG up to 5 MB, and an audio type is not a proof", () => {
  for (const contentType of ["application/pdf", "image/png", "image/jpeg"]) {
    assert.ok(parsePresignInput({ kind: "proof", contentType, size: 5 * 1024 * 1024 }).ok, contentType);
  }
  assert.equal(parsePresignInput({ kind: "proof", contentType: "image/png", size: 5 * 1024 * 1024 + 1 }).ok, false);
  assert.equal(parsePresignInput({ kind: "proof", contentType: "audio/mp4", size: 10 }).ok, false);
  assert.equal(parsePresignInput({ kind: "proof", contentType: "image/svg+xml", size: 10 }).ok, false);
});

test("sha256: 64 lower-case hex only", () => {
  assert.equal(isSha256Hex(SHA), true);
  assert.equal(isSha256Hex("A".repeat(64)), false);
  assert.equal(isSha256Hex("a".repeat(63)), false);
  assert.equal(isSha256Hex("g".repeat(64)), false);
  assert.equal(isSha256Hex(null), false);
});

test("magic bytes: m4a needs an ftyp box, mp3 an ID3 tag or a frame sync", () => {
  const m4a = Uint8Array.from([0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41]);
  const id3 = Uint8Array.from([0x49, 0x44, 0x33, 4, 0]);
  const sync = Uint8Array.from([0xff, 0xfb, 0x90, 0x64]);
  const html = new TextEncoder().encode("<html><body>");
  assert.equal(looksLikeAudio(m4a, "audio/mp4"), true);
  assert.equal(looksLikeAudio(id3, "audio/mp4"), false);
  assert.equal(looksLikeAudio(id3, "audio/mpeg"), true);
  assert.equal(looksLikeAudio(sync, "audio/mpeg"), true);
  assert.equal(looksLikeAudio(m4a, "audio/mpeg"), false);
  assert.equal(looksLikeAudio(html, "audio/mpeg"), false);
  assert.equal(looksLikeAudio(html, "audio/mp4"), false);
  assert.equal(looksLikeAudio(new Uint8Array(0), "audio/mp4"), false);
  // Reserved MPEG version (01) is not a real frame.
  assert.equal(looksLikeAudio(Uint8Array.from([0xff, 0xea]), "audio/mpeg"), false);

  assert.equal(looksLikeProof(new TextEncoder().encode("%PDF-1.7"), "application/pdf"), true);
  assert.equal(looksLikeProof(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png"), true);
  assert.equal(looksLikeProof(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg"), true);
  assert.equal(looksLikeProof(html, "application/pdf"), false);
  assert.equal(looksLikeProof(html, "image/png"), false);
});

test("prefs: booleans and known moods only, at least one field", () => {
  assert.deepEqual(parsePrefsInput({ pauseDuringTests: false }), { ok: true, value: { pauseDuringTests: false } });
  assert.deepEqual(parsePrefsInput({ defaultMood: "nature" }), { ok: true, value: { defaultMood: "nature" } });
  assert.equal(parsePrefsInput({ defaultMood: "jazz" }).ok, false);
  assert.equal(parsePrefsInput({ pauseDuringTests: "false" }).ok, false);
  assert.equal(parsePrefsInput({ pauseDuringTests: 1 }).ok, false);
  assert.equal(parsePrefsInput({}).ok, false);
});

test("listen: uuids, whole seconds, focus never above seconds, startedAt clamped", () => {
  const base = { sessionId: "11111111-1111-4111-8111-111111111111", trackId: "22222222-2222-4222-8222-222222222222", seconds: 60, focusSeconds: 30 };
  const ok = parseListenInput(base);
  assert.ok(ok.ok && ok.value.startedAt === null && ok.value.focusSeconds === 30);
  const capped = parseListenInput({ ...base, focusSeconds: 90 });
  assert.ok(capped.ok && capped.value.focusSeconds === 60);
  assert.equal(parseListenInput({ ...base, sessionId: "nope" }).ok, false);
  assert.equal(parseListenInput({ ...base, trackId: "../x" }).ok, false);
  assert.equal(parseListenInput({ ...base, seconds: -1 }).ok, false);
  assert.equal(parseListenInput({ ...base, seconds: 1.5 }).ok, false);
  assert.equal(parseListenInput({ ...base, seconds: 24 * 3600 + 1 }).ok, false);
  const now = Date.parse("2026-11-14T10:00:00Z");
  const future = parseListenInput({ ...base, startedAt: "2026-11-15T10:00:00Z" }, now);
  assert.ok(future.ok && future.value.startedAt?.getTime() === now);
  const old = parseListenInput({ ...base, startedAt: "2026-11-01T10:00:00Z" }, now);
  assert.ok(old.ok && old.value.startedAt?.getTime() === now - 24 * 3600 * 1000);
  assert.equal(parseListenInput({ ...base, startedAt: "yesterday-ish" }, now).ok, false);
});

test("Music today text", () => {
  assert.equal(formatMusicToday({ seconds: 2520, focusSeconds: 1800 }), "Music today: 42 min · 30 min in focus");
  assert.equal(formatMusicToday({ seconds: 59, focusSeconds: -5 }), "Music today: 0 min · 0 min in focus");
});
