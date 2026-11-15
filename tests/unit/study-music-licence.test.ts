/**
 * Study Music licence fields (src/lib/study-music.ts): every one is required,
 * links are https-only display links (no credentials, ≤ 500 chars), credit
 * text is 1–300 characters kept as plain text, and publishing is refused while
 * any licence field is blank. V1/STUDY_MUSIC_PLAN.md §11.1, §12.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  MUSIC_LICENCE_PRESETS,
  cleanHttpsUrl,
  missingLicenceFields,
  parseTrackFields,
  parseTrackPatch,
} from "../../src/lib/study-music";

const GOOD = {
  title: "Rain",
  artist: "Origin",
  mood: "nature",
  durationSeconds: 120,
  sourceUrl: "https://freesound.org/s/1/",
  licenceName: "CC BY 4.0",
  licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
  attributionRequired: true,
  attributionText: "‘Rain’ by Someone, CC BY 4.0",
};

test("every licence field is required on a new track", () => {
  for (const key of ["sourceUrl", "licenceName", "licenceUrl", "attributionRequired", "attributionText"] as const) {
    const body: Record<string, unknown> = { ...GOOD };
    delete body[key];
    assert.equal(parseTrackFields(body).ok, false, key);
  }
});

test("links: https only, a real host, no user:pass, at most 500 characters", () => {
  assert.equal(cleanHttpsUrl("https://incompetech.com/music/royalty-free/"), "https://incompetech.com/music/royalty-free/");
  assert.equal(cleanHttpsUrl("HTTPS://example.com/x"), "https://example.com/x");
  for (const bad of [
    "http://example.com/",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "https://user:pass@example.com/",
    "https://user@example.com/",
    "https://",
    "//example.com",
    "https://exa mple.com/",
    "https://example.com/\nx",
    `https://example.com/${"a".repeat(500)}`,
    "",
    42,
  ]) {
    assert.equal(cleanHttpsUrl(bad), null, String(bad));
  }
  assert.ok(cleanHttpsUrl(`https://e.co/${"a".repeat(500 - "https://e.co/".length)}`));
  assert.equal(parseTrackFields({ ...GOOD, sourceUrl: "http://freesound.org/" }).ok, false);
  assert.equal(parseTrackFields({ ...GOOD, licenceUrl: "javascript:alert(1)" }).ok, false);
});

test("credit text: 1–300 characters, HTML kept as plain text (never stripped or rendered)", () => {
  const html = parseTrackFields({ ...GOOD, attributionText: "<b>Rain</b> by <script>x</script>" });
  assert.ok(html.ok && html.value.attributionText === "<b>Rain</b> by <script>x</script>");
  assert.ok(parseTrackFields({ ...GOOD, attributionText: "x".repeat(300) }).ok);
  assert.equal(parseTrackFields({ ...GOOD, attributionText: "x".repeat(301) }).ok, false);
  assert.equal(parseTrackFields({ ...GOOD, attributionText: " " }).ok, false);
});

test("publish is refused while any licence field is blank or broken", () => {
  const stored = {
    sourceUrl: GOOD.sourceUrl,
    licenceName: GOOD.licenceName,
    licenceUrl: GOOD.licenceUrl,
    attributionRequired: true,
    attributionText: GOOD.attributionText,
  };
  assert.deepEqual(missingLicenceFields(stored), []);
  assert.deepEqual(missingLicenceFields({ ...stored, sourceUrl: "" }), ["sourceUrl"]);
  assert.deepEqual(missingLicenceFields({ ...stored, licenceName: "  " }), ["licenceName"]);
  assert.deepEqual(missingLicenceFields({ ...stored, licenceUrl: "http://x.org" }), ["licenceUrl"]);
  assert.deepEqual(missingLicenceFields({ ...stored, attributionRequired: null }), ["attributionRequired"]);
  assert.deepEqual(missingLicenceFields({ ...stored, attributionText: "" }), ["attributionText"]);
  assert.equal(missingLicenceFields({}).length, 5);
});

test("an edit may not blank a licence field either", () => {
  assert.equal(parseTrackPatch({ sourceUrl: "" }).ok, false);
  assert.equal(parseTrackPatch({ attributionText: "" }).ok, false);
  assert.equal(parseTrackPatch({}).ok, false);
  assert.ok(parseTrackPatch({ title: "New" }).ok);
});

test("licence presets: no NC / ND / SA and no Pixabay; every preset link is https", () => {
  for (const preset of MUSIC_LICENCE_PRESETS) {
    assert.doesNotMatch(preset.name, /\bNC\b|\bND\b|\bSA\b|pixabay/i, preset.name);
    assert.ok(cleanHttpsUrl(preset.url), preset.name);
  }
  const cc0 = MUSIC_LICENCE_PRESETS.find((p) => p.name === "CC0 1.0");
  const by = MUSIC_LICENCE_PRESETS.find((p) => p.name === "CC BY 4.0");
  assert.equal(cc0?.attributionRequired, false);
  assert.equal(by?.attributionRequired, true);
});
