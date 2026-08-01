/**
 * Study Mode — pure model unit tests. No DB, no flags; safe to run anywhere.
 *
 * See V1/allmd/STUDY_MODE_JEE_NEET_PCMB_PLAN_2026-08-01.md.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  ALL_STUDY_MODES,
  DEFAULT_STUDY_MODE,
  STUDY_MODE_SUBJECTS,
  availableStudyModes,
  fromAiSubjectKey,
  studyModeCoverage,
  inferStudyModeFromProfile,
  isStudyMode,
  isSubjectInMode,
  normalizeStudyMode,
  occurrenceMatchesMode,
  studyModeAiSubjectKeys,
  studyModeExamFamilies,
  studyModeSubjects,
  toAiSubjectKey,
} from "../../src/lib/study-mode";
import { ALL_SUBJECTS } from "../../src/lib/entitlements";

test("constants are stable", () => {
  assert.deepEqual(ALL_STUDY_MODES, ["jee", "neet", "pcmb"]);
  // The safe default is "everything visible" — a live student must never lose a
  // subject just because the feature shipped.
  assert.equal(DEFAULT_STUDY_MODE, "pcmb");
});

test("each mode exposes exactly the advertised subjects", () => {
  assert.deepEqual(STUDY_MODE_SUBJECTS.jee, ["physics", "chemistry", "mathematics"]);
  assert.deepEqual(STUDY_MODE_SUBJECTS.neet, ["physics", "chemistry", "biology"]);
  assert.deepEqual(STUDY_MODE_SUBJECTS.pcmb, ALL_SUBJECTS);
  // JEE never shows Biology; NEET never shows Mathematics. The whole feature.
  assert.ok(!STUDY_MODE_SUBJECTS.jee.includes("biology"));
  assert.ok(!STUDY_MODE_SUBJECTS.neet.includes("mathematics"));
});

test("mode subject lists follow the canonical ALL_SUBJECTS ordering", () => {
  for (const mode of ALL_STUDY_MODES) {
    const subjects = studyModeSubjects(mode);
    const canonical = ALL_SUBJECTS.filter((s) => subjects.includes(s));
    assert.deepEqual(subjects, canonical, `${mode} is out of canonical order`);
  }
});

test("studyModeSubjects hands out copies, so callers cannot corrupt the table", () => {
  // This is module-level state in a long-lived server process: one caller doing
  // .push()/.sort() on a returned array must not leak into every later request.
  const first = studyModeSubjects("jee");
  first.push("biology");
  first.sort();
  assert.deepEqual(studyModeSubjects("jee"), ["physics", "chemistry", "mathematics"]);
  assert.deepEqual(STUDY_MODE_SUBJECTS.jee, ["physics", "chemistry", "mathematics"]);
  assert.notEqual(studyModeSubjects("jee"), studyModeSubjects("jee"), "returns a fresh array");
});

test("the STUDY_MODE_SUBJECTS table itself is frozen", () => {
  assert.ok(Object.isFrozen(STUDY_MODE_SUBJECTS));
  for (const mode of ALL_STUDY_MODES) {
    assert.ok(Object.isFrozen(STUDY_MODE_SUBJECTS[mode]), `${mode} list is not frozen`);
  }
});

test("normalizeStudyMode accepts canonical values, shorthands and messy casing", () => {
  assert.equal(normalizeStudyMode("jee"), "jee");
  assert.equal(normalizeStudyMode("NEET"), "neet");
  assert.equal(normalizeStudyMode("  Pcmb "), "pcmb");
  assert.equal(normalizeStudyMode("PCM"), "jee");
  assert.equal(normalizeStudyMode("pcb"), "neet");
  assert.equal(normalizeStudyMode("AIPMT"), "neet");
  assert.equal(normalizeStudyMode("Foundation"), "pcmb");
  assert.equal(normalizeStudyMode("jee-mode"), "jee");
  assert.equal(normalizeStudyMode("NEET_MODE"), "neet");
});

test("normalizeStudyMode rejects anything else", () => {
  for (const bad of ["", "   ", "physics", "jeemain", "cbse", null, undefined, 1, {}, []]) {
    assert.equal(normalizeStudyMode(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

test("isStudyMode is a true type guard", () => {
  assert.ok(isStudyMode("jee"));
  assert.ok(!isStudyMode("JEE"), "isStudyMode is exact — use normalizeStudyMode for loose input");
  assert.ok(!isStudyMode(null));
});

test("isSubjectInMode covers every mode x subject pair", () => {
  const expected: Record<string, string[]> = {
    jee: ["physics", "chemistry", "mathematics"],
    neet: ["physics", "chemistry", "biology"],
    pcmb: ["physics", "chemistry", "mathematics", "biology"],
  };
  for (const mode of ALL_STUDY_MODES) {
    for (const subject of ALL_SUBJECTS) {
      assert.equal(
        isSubjectInMode(mode, subject),
        expected[mode].includes(subject),
        `${mode} / ${subject}`,
      );
    }
  }
});

test("isSubjectInMode accepts loose subject spellings", () => {
  assert.ok(isSubjectInMode("jee", "Maths"));
  assert.ok(isSubjectInMode("jee", "MATHEMATICS"));
  assert.ok(isSubjectInMode("neet", "bio"));
  assert.ok(!isSubjectInMode("jee", "bio"));
  assert.ok(!isSubjectInMode("neet", "math"));
});

test("subject-less content stays visible in every mode", () => {
  // Same rule the premium gate already applies: `mixed`/`all`/empty/unknown must
  // never vanish just because a mode is active.
  for (const mode of ALL_STUDY_MODES) {
    assert.ok(isSubjectInMode(mode, "mixed"));
    assert.ok(isSubjectInMode(mode, "all"));
    assert.ok(isSubjectInMode(mode, ""));
    assert.ok(isSubjectInMode(mode, "   "));
    assert.ok(isSubjectInMode(mode, null));
    assert.ok(isSubjectInMode(mode, undefined));
    assert.ok(isSubjectInMode(mode, "general-knowledge"));
  }
});

// ── Toggle eligibility (a mode is selectable only when fully owned) ──────────

test("studyModeCoverage reports exactly which subjects are missing", () => {
  assert.deepEqual(studyModeCoverage("jee", ALL_SUBJECTS), { covered: true, missing: [] });
  assert.deepEqual(studyModeCoverage("neet", ["physics", "chemistry"]), {
    covered: false,
    missing: ["biology"],
  });
  assert.deepEqual(studyModeCoverage("pcmb", ["physics"]), {
    covered: false,
    missing: ["chemistry", "mathematics", "biology"],
  });
  // Missing subjects come back in canonical order so the UI copy reads naturally.
  assert.deepEqual(studyModeCoverage("pcmb", ["biology", "chemistry"]).missing, [
    "physics",
    "mathematics",
  ]);
});

test("owning all four subjects offers a real three-way choice", () => {
  assert.deepEqual(availableStudyModes(ALL_SUBJECTS), ["jee", "neet", "pcmb"]);
});

test("owning exactly one bundle offers only that bundle's mode", () => {
  assert.deepEqual(availableStudyModes(["physics", "chemistry", "mathematics"]), ["jee"]);
  assert.deepEqual(availableStudyModes(["physics", "chemistry", "biology"]), ["neet"]);
});

test("owning one or two subjects offers no mode at all", () => {
  // The rule behind toggle availability: a partial buyer has nothing to toggle
  // between, and any mode would hide something they paid for.
  assert.deepEqual(availableStudyModes([]), []);
  assert.deepEqual(availableStudyModes(["physics"]), []);
  assert.deepEqual(availableStudyModes(["biology"]), []);
  assert.deepEqual(availableStudyModes(["physics", "chemistry"]), []);
  assert.deepEqual(availableStudyModes(["mathematics", "biology"]), []);
});

test("a mode is never offered when any of its subjects is missing", () => {
  for (const mode of ALL_STUDY_MODES) {
    for (const subject of studyModeSubjects(mode)) {
      const owned = ALL_SUBJECTS.filter((s) => s !== subject);
      assert.ok(
        !availableStudyModes(owned).includes(mode),
        `${mode} was offered without ${subject}`,
      );
    }
  }
});

test("availableStudyModes ignores subject order and duplicates", () => {
  assert.deepEqual(availableStudyModes(["mathematics", "physics", "chemistry", "physics"]), ["jee"]);
});

test("exam families are a soft preference, and PCMB has none", () => {
  assert.deepEqual(studyModeExamFamilies("jee"), ["JEE"]);
  assert.deepEqual(studyModeExamFamilies("neet"), ["NEET", "AIPMT"]);
  assert.deepEqual(studyModeExamFamilies("pcmb"), []);
});

test("occurrenceMatchesMode matches year/variant-suffixed occurrence values", () => {
  // Live rows carry values like "JEE (2020)", "JEE Main", "NEET 2019".
  assert.ok(occurrenceMatchesMode("jee", "JEE (2020)"));
  assert.ok(occurrenceMatchesMode("jee", "JEE Main"));
  assert.ok(!occurrenceMatchesMode("jee", "NEET 2019"));
  assert.ok(occurrenceMatchesMode("neet", "NEET 2019"));
  assert.ok(occurrenceMatchesMode("neet", "AIPMT 2011"));
  assert.ok(!occurrenceMatchesMode("neet", "JEE Advanced"));
  // No preference → everything matches, including a blank occurrence.
  assert.ok(occurrenceMatchesMode("pcmb", "JEE Advanced"));
  assert.ok(occurrenceMatchesMode("pcmb", ""));
  assert.ok(occurrenceMatchesMode("pcmb", null));
  // A mode WITH a preference does not match a blank occurrence.
  assert.ok(!occurrenceMatchesMode("jee", ""));
  assert.ok(!occurrenceMatchesMode("jee", null));
});

test("inferStudyModeFromProfile reads the decorative onboarding course", () => {
  assert.equal(inferStudyModeFromProfile("JEE", null), "jee");
  assert.equal(inferStudyModeFromProfile("NEET", null), "neet");
  assert.equal(inferStudyModeFromProfile("Foundation", null), "pcmb");
  // The legacy seed value in src/legacy/store.ts must not fall through.
  assert.equal(inferStudyModeFromProfile("JEE Main + Advanced", null), "jee");
  assert.equal(inferStudyModeFromProfile("NEET (UG)", null), "neet");
});

test("inferStudyModeFromProfile falls back to the onboarding subject picks", () => {
  assert.equal(inferStudyModeFromProfile(null, ["Physics", "Chemistry", "Mathematics"]), "jee");
  assert.equal(inferStudyModeFromProfile(null, ["Physics", "Chemistry", "Biology"]), "neet");
  assert.equal(inferStudyModeFromProfile("", ["Physics", "Maths", "Biology"]), "pcmb");
  // Physics-only tells us nothing about JEE vs NEET.
  assert.equal(inferStudyModeFromProfile(null, ["Physics"]), null);
  assert.equal(inferStudyModeFromProfile(null, []), null);
  assert.equal(inferStudyModeFromProfile(null, null), null);
  assert.equal(inferStudyModeFromProfile(null, ["Astrology"]), null);
});

test("course wins over subjects when both are present", () => {
  assert.equal(inferStudyModeFromProfile("NEET", ["Physics", "Mathematics"]), "neet");
});

test("AI subject keys round-trip", () => {
  assert.equal(toAiSubjectKey("physics"), "phy");
  assert.equal(toAiSubjectKey("chemistry"), "chem");
  assert.equal(toAiSubjectKey("mathematics"), "math");
  assert.equal(toAiSubjectKey("biology"), "bio");
  for (const subject of ALL_SUBJECTS) {
    assert.equal(fromAiSubjectKey(toAiSubjectKey(subject)), subject);
  }
  assert.equal(fromAiSubjectKey("nope"), null);
  assert.equal(fromAiSubjectKey(null), null);
});

test("studyModeAiSubjectKeys mirrors the mode's subjects", () => {
  assert.deepEqual(studyModeAiSubjectKeys("jee"), ["phy", "chem", "math"]);
  assert.deepEqual(studyModeAiSubjectKeys("neet"), ["phy", "chem", "bio"]);
  assert.deepEqual(studyModeAiSubjectKeys("pcmb"), ["phy", "chem", "math", "bio"]);
});
