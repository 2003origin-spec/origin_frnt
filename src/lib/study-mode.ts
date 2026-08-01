/**
 * Study Mode (JEE / NEET / PCMB) — pure, client-safe model.
 *
 * A student picks ONE mode; the mode decides which of the four canonical
 * `Subject`s the student sees across the whole app. Nothing here touches the
 * database, `next/*`, or any browser API, so it is safe to import from client
 * components, RSC, route handlers and `node:test` alike — the same split
 * `src/lib/entitlements.ts` (pure) / `src/server/entitlements.ts` (DB) uses.
 *
 * The DB-backed resolver and the composition with premium entitlements live in
 * `src/server/study-scope.ts`.
 *
 * See V1/allmd/STUDY_MODE_JEE_NEET_PCMB_PLAN_2026-08-01.md.
 */

import { ALL_SUBJECTS, normalizeSubject, type Subject } from "@/lib/entitlements";

export type StudyMode = "jee" | "neet" | "pcmb";

export const ALL_STUDY_MODES: StudyMode[] = ["jee", "neet", "pcmb"];

/**
 * The subject set each mode exposes. Order matches ALL_SUBJECTS so every list
 * the student sees is in the same canonical order regardless of mode.
 *
 * Frozen, and `studyModeSubjects()` hands out copies: this is module-level state
 * in a long-lived server process, so one caller doing `.push()`/`.sort()` on a
 * returned array would otherwise silently corrupt every later request.
 */
export const STUDY_MODE_SUBJECTS: Readonly<Record<StudyMode, readonly Subject[]>> = Object.freeze({
  jee: Object.freeze<Subject[]>(["physics", "chemistry", "mathematics"]),
  neet: Object.freeze<Subject[]>(["physics", "chemistry", "biology"]),
  pcmb: Object.freeze<Subject[]>([...ALL_SUBJECTS]),
});

export const STUDY_MODE_LABELS: Record<StudyMode, string> = {
  jee: "JEE Mode",
  neet: "NEET Mode",
  pcmb: "PCMB",
};

/** Short subject line shown under each option in the toggle. */
export const STUDY_MODE_BLURB: Record<StudyMode, string> = {
  jee: "Physics · Chemistry · Maths",
  neet: "Physics · Chemistry · Biology",
  pcmb: "Physics · Chemistry · Maths · Biology",
};

/**
 * Mode for a student who has never chosen one (origin_users.study_mode IS NULL).
 *
 * Deliberately `pcmb` — everything visible, i.e. byte-identical to the
 * pre-feature behaviour. We do NOT silently infer jee/neet from the decorative
 * onboarding `selectedCourse`, because that would make Biology disappear
 * overnight for a live student who has been practising it. Adoption happens via
 * the dismissible first-run prompt instead (plan §3.4).
 */
export const DEFAULT_STUDY_MODE: StudyMode = "pcmb";

export function isStudyMode(value: unknown): value is StudyMode {
  return typeof value === "string" && (ALL_STUDY_MODES as string[]).includes(value);
}

/**
 * Maps loose spellings to a canonical mode. Tolerates casing/whitespace and the
 * common subject-combination shorthands students type ("PCM", "PCB").
 */
export function normalizeStudyMode(value: unknown): StudyMode | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (!v) return null;
  if (v === "jee" || v === "pcm" || v === "jeemode") return "jee";
  if (v === "neet" || v === "pcb" || v === "aipmt" || v === "neetmode") return "neet";
  if (v === "pcmb" || v === "all" || v === "both" || v === "foundation") return "pcmb";
  return null;
}

/** The mode's subjects, as a fresh array the caller may freely filter or sort. */
export function studyModeSubjects(mode: StudyMode): Subject[] {
  return [...(STUDY_MODE_SUBJECTS[mode] ?? STUDY_MODE_SUBJECTS[DEFAULT_STUDY_MODE])];
}

/**
 * Is a subject-tagged item inside the mode?
 *
 * `mixed` / `all` / empty / unrecognised subjects are TRUE in every mode — the
 * exact rule `subjectVisibleUnderGate` already applies for premium entitlements,
 * so a subject-less item never vanishes just because a mode is active.
 */
export function isSubjectInMode(mode: StudyMode, subject: string | null | undefined): boolean {
  const raw = String(subject ?? "").trim().toLowerCase();
  if (!raw || raw === "mixed" || raw === "all") return true;
  const canonical = normalizeSubject(raw);
  if (!canonical) return true;
  return studyModeSubjects(mode).includes(canonical);
}

/**
 * How well an owned subject set covers a mode.
 *
 * A mode is `covered` only when the student owns EVERY subject in it — owning
 * two of JEE's three does not make JEE a real option, it makes it a worse
 * version of what they already have.
 */
export function studyModeCoverage(
  mode: StudyMode,
  owned: readonly Subject[],
): { covered: boolean; missing: Subject[] } {
  const missing = studyModeSubjects(mode).filter((s) => !owned.includes(s));
  return { covered: missing.length === 0, missing };
}

/**
 * The modes a student may actually select, given the subjects they own —
 * i.e. every mode whose subject set is a SUBSET of `owned`, in canonical order.
 *
 *   owns P,C,M,B  → ["jee", "neet", "pcmb"]   (a real three-way choice)
 *   owns P,C,M    → ["jee"]                   (JEE is the only mode they fully own)
 *   owns P,C,B    → ["neet"]
 *   owns P,C      → []                        (no complete bundle — no choice to make)
 *
 * This is the rule behind toggle availability: a student who bought one or two
 * subjects has nothing to toggle between, because their entitlement already
 * scopes them more tightly than any mode would. Switching them into a mode could
 * only ever hide something they paid for.
 */
export function availableStudyModes(owned: readonly Subject[]): StudyMode[] {
  return ALL_STUDY_MODES.filter((mode) => studyModeCoverage(mode, owned).covered);
}

/**
 * Exam families a mode PREFERS. Used only by the Daily Mission, as a soft
 * preference tier — never as a hard filter, because a JEE aspirant legitimately
 * practises NEET-origin Physics questions (plan open question Q2).
 *
 * `pcmb` returns [] meaning "no preference".
 */
export function studyModeExamFamilies(mode: StudyMode): string[] {
  if (mode === "jee") return ["JEE"];
  if (mode === "neet") return ["NEET", "AIPMT"];
  return [];
}

/** True when an `occurrence` value belongs to one of the mode's preferred families. */
export function occurrenceMatchesMode(mode: StudyMode, occurrence: string | null | undefined): boolean {
  const families = studyModeExamFamilies(mode);
  if (families.length === 0) return true;
  const raw = String(occurrence ?? "").toUpperCase();
  if (!raw) return false;
  return families.some((family) => raw.includes(family));
}

/**
 * Best-effort seed from the DECORATIVE onboarding fields (`selected_course`,
 * `subjects[]`). Never authoritative — it only pre-selects the first-run prompt.
 * Returns null when nothing can be inferred.
 *
 * `selected_course` is free text: live rows carry "JEE", "NEET", "Foundation"
 * and legacy seeds carry "JEE Main + Advanced", so this matches on substrings.
 */
export function inferStudyModeFromProfile(
  selectedCourse: string | null | undefined,
  subjects: readonly string[] | null | undefined,
): StudyMode | null {
  const course = String(selectedCourse ?? "").toLowerCase();
  if (/neet|aipmt|medical/.test(course)) return "neet";
  if (/jee|engineering/.test(course)) return "jee";
  if (/foundation/.test(course)) return "pcmb";

  const owned = new Set(
    (subjects ?? []).map((s) => normalizeSubject(s)).filter((s): s is Subject => s != null),
  );
  if (owned.size === 0) return null;
  const hasBio = owned.has("biology");
  const hasMath = owned.has("mathematics");
  if (hasBio && hasMath) return "pcmb";
  if (hasBio) return "neet";
  if (hasMath) return "jee";
  return null;
}

/** Origin AI / knowledge-base subject keys (src/server/ai-solver-kb.ts, catalog-cache.ts). */
export type AiSubjectKey = "phy" | "chem" | "math" | "bio";

const AI_SUBJECT_KEYS: Record<Subject, AiSubjectKey> = {
  physics: "phy",
  chemistry: "chem",
  mathematics: "math",
  biology: "bio",
};

export function toAiSubjectKey(subject: Subject): AiSubjectKey {
  return AI_SUBJECT_KEYS[subject];
}

export function fromAiSubjectKey(key: string | null | undefined): Subject | null {
  return normalizeSubject(key);
}

/** The mode's subjects as Origin AI keys, in canonical order. */
export function studyModeAiSubjectKeys(mode: StudyMode): AiSubjectKey[] {
  return studyModeSubjects(mode).map(toAiSubjectKey);
}
