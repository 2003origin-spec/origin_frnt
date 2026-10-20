import test from "node:test";
import assert from "node:assert/strict";

import {
  binExpiresAt,
  checkNotesSettings,
  DEFAULT_NOTES_SETTINGS,
  effectiveLimitBytes,
  fitsInLimit,
  GB,
  maxBytesForKind,
  MB,
  NOTES_SETTING_KEYS,
  parseNotesSettings,
  serialiseNotesSettings,
  storageLevel,
  storagePercent,
  typedNoteBytes,
  billedTypedNoteBytes,
} from "../../src/lib/notes/storage-rules";

test("settings default to 100 MB free, 1 GB premium, 25 MB files, 100 MB videos, 30 Bin days", () => {
  const settings = parseNotesSettings({});
  assert.equal(settings.freeLimitBytes, 100 * MB);
  assert.equal(settings.premiumLimitBytes, 1 * GB);
  assert.equal(settings.maxFileBytes, 25 * MB);
  assert.equal(settings.maxVideoBytes, 100 * MB);
  assert.equal(settings.binDays, 30);
  assert.deepEqual(settings.allowedKinds, ["pdf", "image", "office", "audio", "video"]);
  assert.equal(settings.uploadsEnabled, true);
  assert.equal(settings.sharingEnabled, true);
});

test("broken stored values fall back to the default; out-of-range ones are clamped", () => {
  const settings = parseNotesSettings({
    [NOTES_SETTING_KEYS.freeLimitBytes]: "not a number",
    [NOTES_SETTING_KEYS.maxFileBytes]: String(10 * GB),
    [NOTES_SETTING_KEYS.binDays]: "0",
    [NOTES_SETTING_KEYS.uploadsEnabled]: "off",
    [NOTES_SETTING_KEYS.allowedKinds]: "video, pdf, exe,",
  });
  assert.equal(settings.freeLimitBytes, DEFAULT_NOTES_SETTINGS.freeLimitBytes);
  assert.equal(settings.maxFileBytes, 200 * MB);
  assert.equal(settings.binDays, 1);
  assert.equal(settings.uploadsEnabled, false);
  assert.deepEqual(settings.allowedKinds, ["pdf", "video"], "unknown kinds are dropped, order is fixed");
});

test("an empty allowed-kinds list stays empty (admin turned every upload type off)", () => {
  assert.deepEqual(parseNotesSettings({ [NOTES_SETTING_KEYS.allowedKinds]: "" }).allowedKinds, []);
});

test("settings round-trip through storage strings", () => {
  const custom = { ...DEFAULT_NOTES_SETTINGS, freeLimitBytes: 250 * MB, binDays: 14, sharingEnabled: false, allowedKinds: ["pdf" as const] };
  assert.deepEqual(parseNotesSettings(serialiseNotesSettings(custom)), custom);
});

test("the admin form is checked in plain words", () => {
  assert.deepEqual(checkNotesSettings(DEFAULT_NOTES_SETTINGS), []);
  const problems = checkNotesSettings({ ...DEFAULT_NOTES_SETTINGS, freeLimitBytes: 2 * GB, premiumLimitBytes: 1 * GB, binDays: 120 });
  assert.ok(problems.some((p) => p.includes("can't be smaller than the free limit")));
  assert.ok(problems.some((p) => p.includes("Bin days")));
});

test("which limit applies: personal limit, else premium, else free", () => {
  const settings = DEFAULT_NOTES_SETTINGS;
  assert.equal(effectiveLimitBytes({ overrideBytes: null, premium: false, settings }), 100 * MB);
  assert.equal(effectiveLimitBytes({ overrideBytes: null, premium: true, settings }), 1 * GB);
  assert.equal(effectiveLimitBytes({ overrideBytes: 5 * GB, premium: false, settings }), 5 * GB);
  assert.equal(effectiveLimitBytes({ overrideBytes: 0, premium: true, settings }), 0, "a personal limit of 0 wins too");
});

test("reservations count, so two big uploads can't both slip in", () => {
  const limit = 100 * MB;
  assert.equal(fitsInLimit({ usedBytes: 40 * MB, reservedBytes: 0, extraBytes: 60 * MB, limitBytes: limit }), true);
  assert.equal(fitsInLimit({ usedBytes: 40 * MB, reservedBytes: 30 * MB, extraBytes: 40 * MB, limitBytes: limit }), false);
});

test("a student who dropped from premium keeps files but is over the free limit", () => {
  const settings = DEFAULT_NOTES_SETTINGS;
  const used = 400 * MB;
  const limit = effectiveLimitBytes({ overrideBytes: null, premium: false, settings });
  assert.equal(storageLevel(used, limit), "full");
  assert.equal(storagePercent(used, limit), 100);
  assert.equal(fitsInLimit({ usedBytes: used, reservedBytes: 0, extraBytes: 1, limitBytes: limit }), false);
});

test("warning levels: 80 % warns, 100 % is full, a 0-byte limit is always full", () => {
  assert.equal(storageLevel(79 * MB, 100 * MB), "ok");
  assert.equal(storageLevel(80 * MB, 100 * MB), "warn");
  assert.equal(storageLevel(100 * MB, 100 * MB), "full");
  assert.equal(storageLevel(0, 0), "full");
  assert.equal(storagePercent(0, 100 * MB), 0);
});

test("videos get their own size cap", () => {
  assert.equal(maxBytesForKind("video", DEFAULT_NOTES_SETTINGS), 100 * MB);
  assert.equal(maxBytesForKind("pdf", DEFAULT_NOTES_SETTINGS), 25 * MB);
  assert.equal(maxBytesForKind("audio", DEFAULT_NOTES_SETTINGS), 25 * MB);
});

test("typed notes count their UTF-8 size (Hindi takes 3 bytes a letter)", () => {
  assert.equal(typedNoteBytes("abc"), 3);
  assert.equal(typedNoteBytes("गति"), 9);
});

test("Bin items expire after the Bin days", () => {
  const deleted = new Date("2026-10-01T10:00:00Z");
  assert.equal(binExpiresAt(deleted, 30).toISOString(), "2026-10-31T10:00:00.000Z");
});

test("every typed note costs at least 1 KB, so empty notes aren't free", () => {
  assert.equal(billedTypedNoteBytes(""), 1024);
  assert.equal(billedTypedNoteBytes("x".repeat(5000)), 5000);
});
