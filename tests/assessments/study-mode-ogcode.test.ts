/**
 * Study Mode × OG Code — the decision logic each content surface depends on.
 *
 * These exercise the pure predicates against the exact shapes the OG Code paths
 * feed them, so the rules that decide what a student can see are pinned without
 * needing a database.
 *
 * See V1/allmd/STUDY_MODE_JEE_NEET_PCMB_PLAN_2026-08-01.md.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { ALL_SUBJECTS, FREE_SAMPLE_POOL_SIZE, type Subject } from "../../src/lib/entitlements";
import { studyModeSubjects, type StudyMode } from "../../src/lib/study-mode";
import {
  clampSubjectsToScope,
  narrowingSubjectsFilter,
  subjectVisibleUnderMode,
  subjectVisibleUnderScope,
  type StudentScope,
} from "../../src/server/study-scope";
import type { StudentGate } from "../../src/server/entitlements";

const OPEN_GATE: StudentGate = { enforced: false, subjects: [], anyPremium: true };
const FREE_GATE: StudentGate = { enforced: true, subjects: [], anyPremium: false };
const premiumGate = (...subjects: Subject[]): StudentGate => ({
  enforced: true,
  subjects,
  anyPremium: subjects.length > 0,
});

function scopeFor(
  mode: StudyMode,
  gate: StudentGate,
  { enforced = true }: { enforced?: boolean } = {},
): StudentScope {
  const modeSubjects = enforced ? studyModeSubjects(mode) : [...ALL_SUBJECTS];
  const entitled = gate.enforced && gate.anyPremium ? gate.subjects : ALL_SUBJECTS;
  const subjects = enforced
    ? ALL_SUBJECTS.filter((s) => modeSubjects.includes(s) && entitled.includes(s))
    : [...ALL_SUBJECTS];
  return {
    enforced,
    mode,
    explicit: true,
    modeSubjects,
    gate,
    ownedSubjects: gate.enforced ? [...gate.subjects] : [...ALL_SUBJECTS],
    availableModes: [],
    canChooseMode: false,
    subjects,
    starved: enforced && subjects.length === 0,
  };
}

/**
 * Mirrors `ogcodeSubjectVisible` in src/legacy/assessments.ts: premium students
 * get entitlements ∩ mode, everyone else gets mode only. The distinction is what
 * keeps the free sample pool alive under Study Mode.
 */
function ogcodeSubjectVisible(subject: string | null | undefined, scope: StudentScope): boolean {
  return scope.gate.enforced && scope.gate.anyPremium
    ? subjectVisibleUnderScope(subject, scope)
    : subjectVisibleUnderMode(subject, scope);
}

// ── The free sample pool must survive Study Mode ─────────────────────────────

test("a free student still sees the OG Code pool, scoped to their mode", () => {
  // The trap: subjectVisibleUnderScope returns false for EVERY subject for a
  // free student (inherited from the premium gate). Using it in the OG Code
  // list would blank the 500-question sample pool the free tier is built on.
  const scope = scopeFor("jee", FREE_GATE);
  assert.ok(ogcodeSubjectVisible("physics", scope), "free students keep the sample pool");
  assert.ok(ogcodeSubjectVisible("mathematics", scope));
  assert.ok(!ogcodeSubjectVisible("biology", scope), "...but still mode-scoped");

  // The premium-aware predicate is the one that must refuse everything here.
  assert.ok(!subjectVisibleUnderScope("physics", scope), "premium rule still gates tests/DPPs");
});

test("the free pool cap is unchanged by Study Mode", () => {
  // Mode narrows WHICH questions are in the pool, not how many the free tier
  // may page through.
  assert.equal(FREE_SAMPLE_POOL_SIZE, 500);
});

test("a premium student gets entitlements intersected with mode", () => {
  const scope = scopeFor("jee", premiumGate("physics", "biology"));
  assert.ok(ogcodeSubjectVisible("physics", scope));
  assert.ok(!ogcodeSubjectVisible("biology", scope), "owned but out of mode");
  assert.ok(!ogcodeSubjectVisible("chemistry", scope), "in mode but not owned");
});

// ── The catalog subjects filter ──────────────────────────────────────────────

test("an unscoped request sends NO subjects filter", () => {
  // Passing the full ALL_SUBJECTS list as `subject = ANY(...)` is not the same
  // as passing nothing: rows with legacy/odd subject values would vanish.
  assert.equal(narrowingSubjectsFilter(scopeFor("pcmb", OPEN_GATE)), null);
  assert.equal(narrowingSubjectsFilter(scopeFor("pcmb", OPEN_GATE, { enforced: false })), null);
});

test("a narrowing scope does send its subjects", () => {
  assert.deepEqual(narrowingSubjectsFilter(scopeFor("jee", OPEN_GATE)), [
    "physics",
    "chemistry",
    "mathematics",
  ]);
  assert.deepEqual(narrowingSubjectsFilter(scopeFor("neet", premiumGate("physics", "biology"))), [
    "physics",
    "biology",
  ]);
});

test("an explicit off-mode subject filter yields the empty page, not a wider one", () => {
  // listOgcodeQuestionPage returns emptyPage(0) here. The failure mode this
  // pins: treating "nothing survived" as "no filter" and running unscoped.
  const scope = scopeFor("jee", OPEN_GATE);
  assert.deepEqual(clampSubjectsToScope(["biology"], scope), []);
  assert.notEqual(clampSubjectsToScope(["biology"], scope), null);
});

test("a partially-valid subject filter keeps only the in-scope picks", () => {
  const scope = scopeFor("neet", OPEN_GATE);
  assert.deepEqual(clampSubjectsToScope(["physics", "mathematics"], scope), ["physics"]);
});

// ── Detail access / history ─────────────────────────────────────────────────

test("mode decides detail access, independent of premium", () => {
  // getPracticeQuestionDetail uses the MODE-only predicate so the 403 means
  // "wrong mode", never "you didn't pay" — the premium gate has its own error.
  const freeJee = scopeFor("jee", FREE_GATE);
  assert.ok(subjectVisibleUnderMode("physics", freeJee));
  assert.ok(!subjectVisibleUnderMode("biology", freeJee));
});

test("subject-less content is reachable in every mode", () => {
  for (const mode of ["jee", "neet", "pcmb"] as StudyMode[]) {
    const scope = scopeFor(mode, OPEN_GATE);
    assert.ok(subjectVisibleUnderMode("mixed", scope));
    assert.ok(subjectVisibleUnderMode(null, scope));
    assert.ok(subjectVisibleUnderMode("", scope));
  }
});

test("a starved scope hides everything without crashing", () => {
  const scope = scopeFor("jee", premiumGate("biology"));
  assert.ok(scope.starved);
  for (const subject of ALL_SUBJECTS) {
    assert.ok(!ogcodeSubjectVisible(subject, scope));
  }
});

// ── Leaderboard arenas ──────────────────────────────────────────────────────

test("subject arenas follow the mode; the overall board is untouched", () => {
  const scope = scopeFor("jee", OPEN_GATE);
  assert.ok(!subjectVisibleUnderMode("biology", scope), "no Biology arena in JEE mode");
  assert.ok(subjectVisibleUnderMode("mathematics", scope));
  // The overall board takes no subject at all, so it never reaches this check —
  // pinned here so a future refactor doesn't start scoping it.
  assert.ok(subjectVisibleUnderMode(null, scope));
});
