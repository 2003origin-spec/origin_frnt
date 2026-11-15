/**
 * Study Music object keys and upload tokens: keys are made by the server and
 * matched by a strict pattern; the upload token binds the admin, the key and
 * the exact size, and expires with the presigned PUT. V1/STUDY_MUSIC_PLAN.md §4.2, §11.1.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { audioMimeForKey, isMusicProofKey, isMusicTrackKey, musicObjectKey, proofMimeForKey } from "../../src/lib/study-music";
import { MUSIC_UPLOAD_TOKEN_TTL_MS, createMusicUploadToken, verifyMusicUploadToken } from "../../src/server/music/rules";

process.env.R2_SECRET_ACCESS_KEY = "unit-test-secret";
const U = "0b0e2c1e-1111-4111-8111-111111111111";

test("server-made keys: music/tracks/<uuid>.<ext> and music/proof/<uuid>.<ext>", () => {
  assert.equal(musicObjectKey("audio", U, "audio/mp4"), `music/tracks/${U}.m4a`);
  assert.equal(musicObjectKey("audio", U, "audio/mpeg"), `music/tracks/${U}.mp3`);
  assert.equal(musicObjectKey("proof", U, "application/pdf"), `music/proof/${U}.pdf`);
  assert.equal(musicObjectKey("proof", U, "image/jpeg"), `music/proof/${U}.jpg`);
  assert.throws(() => musicObjectKey("audio", "not-a-uuid", "audio/mp4"));
  assert.throws(() => musicObjectKey("audio", U, "application/pdf"));
  assert.throws(() => musicObjectKey("proof", U, "audio/mp4"));
});

test("track key pattern refuses traversal, other prefixes, other types and case tricks", () => {
  assert.equal(isMusicTrackKey(`music/tracks/${U}.m4a`), true);
  assert.equal(isMusicTrackKey(`music/tracks/${U}.mp3`), true);
  for (const bad of [
    `music/tracks/../${U}.m4a`,
    `music/tracks/${U}.m4a/../../imports/x`,
    `/music/tracks/${U}.m4a`,
    `imports/uploads/${U}/a.m4a`,
    `music/proof/${U}.pdf`,
    `music/tracks/${U}.wav`,
    `music/tracks/${U.toUpperCase()}.m4a`,
    `MUSIC/tracks/${U}.m4a`,
    `music/tracks/${U}.M4A`,
    `music/tracks/${U}.m4a\n`,
    `music/tracks/${U}`,
    "",
    null,
  ]) {
    assert.equal(isMusicTrackKey(bad), false, String(bad));
  }
  assert.equal(isMusicProofKey(`music/proof/${U}.png`), true);
  assert.equal(isMusicProofKey(`music/tracks/${U}.m4a`), false);
  assert.equal(audioMimeForKey(`music/tracks/${U}.m4a`), "audio/mp4");
  assert.equal(audioMimeForKey(`music/tracks/${U}.mp3`), "audio/mpeg");
  assert.equal(audioMimeForKey("music/tracks/x.m4a"), null);
  assert.equal(proofMimeForKey(`music/proof/${U}.jpg`), "image/jpeg");
});

test("upload token: bound to the admin, the key and the exact size", () => {
  const key = `music/tracks/${U}.m4a`;
  const now = 1_800_000_000_000;
  const token = createMusicUploadToken("u_admin", key, 12345, now);
  assert.equal(verifyMusicUploadToken(token, "u_admin", key, now), 12345);
  assert.equal(verifyMusicUploadToken(token, "u_other_admin", key, now), null, "another admin");
  assert.equal(verifyMusicUploadToken(token, "u_admin", `music/tracks/${U}.mp3`, now), null, "another key");
  // Swapping the size inside the token breaks the signature.
  const [exp, , sig] = token.split(".");
  assert.equal(verifyMusicUploadToken(`${exp}.99999.${sig}`, "u_admin", key, now), null, "swapped size");
  assert.equal(verifyMusicUploadToken(`${Number(exp) + 1}.12345.${sig}`, "u_admin", key, now), null, "swapped expiry");
});

test("upload token: expired, malformed or unsigned → refused, never throws", () => {
  const key = `music/tracks/${U}.m4a`;
  const now = 1_800_000_000_000;
  const token = createMusicUploadToken("u_admin", key, 10, now);
  assert.equal(verifyMusicUploadToken(token, "u_admin", key, now + MUSIC_UPLOAD_TOKEN_TTL_MS + 1), null, "expired");
  for (const bad of [undefined, null, 1, "", "a.b.c", `${now}.10`, `${now}.10.${"z".repeat(64)}`, token + "0"]) {
    assert.equal(verifyMusicUploadToken(bad, "u_admin", key, now), null, String(bad));
  }
  const saved = process.env.R2_SECRET_ACCESS_KEY;
  delete process.env.R2_SECRET_ACCESS_KEY;
  try {
    assert.equal(verifyMusicUploadToken(token, "u_admin", key, now), null, "no secret");
  } finally {
    process.env.R2_SECRET_ACCESS_KEY = saved;
  }
});

test("upload token is domain-separated from the import upload token", async () => {
  const { createImportUploadToken } = await import("../../src/server/media-storage");
  const key = `music/tracks/${U}.m4a`;
  const importToken = createImportUploadToken("u_admin", key);
  assert.equal(verifyMusicUploadToken(importToken, "u_admin", key), null);
});
