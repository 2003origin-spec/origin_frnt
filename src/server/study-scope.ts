/**
 * Study Mode — the DB-backed server authority.
 *
 * `getStudentScope` is the ONE place that answers "which subjects may this
 * request see?". It composes two independent concerns:
 *
 *   Study Mode  — what the student CHOSE to study (jee / neet / pcmb)
 *   StudentGate — what the student PAID for (premium entitlements)
 *
 * The effective set is their INTERSECTION. Study Mode can only ever narrow
 * access; it never widens what the premium gate allows.
 *
 * Mirrors `src/server/entitlements.ts` in shape deliberately — every OG Code /
 * DPP / test surface already threads a `StudentGate`, so swapping in a
 * `StudentScope` is a one-line change at each call site.
 *
 * See V1/allmd/STUDY_MODE_JEE_NEET_PCMB_PLAN_2026-08-01.md.
 */

import { cache } from "react";

import { ALL_SUBJECTS, normalizeSubject, type Subject } from "@/lib/entitlements";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  ALL_STUDY_MODES,
  DEFAULT_STUDY_MODE,
  availableStudyModes,
  normalizeStudyMode,
  studyModeSubjects,
  type StudyMode,
} from "@/lib/study-mode";
import { getEntitlementSummary, getStudentGate, type StudentGate } from "@/server/entitlements";
import { dbGetStudyMode } from "@/server/db-users";
import { isUserPostgresConfigured } from "@/server/user-postgres";

export type StudentScope = {
  /**
   * True only when the studyModes flag is ON **and** the caller is a student.
   * When false every predicate here is a no-op and `subjects` is ALL_SUBJECTS —
   * byte-identical to the pre-feature behaviour.
   */
  enforced: boolean;
  /** The resolved mode. Always populated, even when `enforced` is false. */
  mode: StudyMode;
  /** True when the student has explicitly chosen (study_mode IS NOT NULL). */
  explicit: boolean;
  /** Subjects the mode alone allows. */
  modeSubjects: Subject[];
  /** The pre-existing premium gate, unmodified. */
  gate: StudentGate;
  /**
   * Subjects the student actually owns. `ALL_SUBJECTS` when the premium gate is
   * not enforced (flag off / dev), so local work is never crippled by billing.
   */
  ownedSubjects: Subject[];
  /**
   * The modes this student may select. Fully-owned modes for a purchaser;
   * any mode with a non-empty intersection for a granted student. See
   * `resolveStudyModeAccess` for the full rule.
   */
  availableModes: StudyMode[];
  /**
   * Whether the mode toggle is offered at all. Always false for free students,
   * and false for someone who BOUGHT only one or two subjects (their entitlement
   * already scopes them tighter than any mode would). Granted students always
   * get it — see `resolveStudyModeAccess`.
   */
  canChooseMode: boolean;
  /**
   * EFFECTIVE visible subjects:
   *   modeSubjects ∩ (gate enforced && premium ? gate.subjects : ALL_SUBJECTS)
   * Canonical order, deduped.
   */
  subjects: Subject[];
  /**
   * True when the intersection is empty — the chosen mode hides every subject
   * the student owns (e.g. JEE Mode + a Biology-only subscription). Surfaces
   * render a dedicated empty state instead of looking broken. Plan §6.1.
   */
  starved: boolean;
};

export type StudyModeAccess = {
  /**
   * Subjects the student effectively owns. `ALL_SUBJECTS` when the premium gate
   * is not being enforced (flag off, non-student, local dev) — billing state must
   * never decide what a teacher or a dev sees.
   */
  ownedSubjects: Subject[];
  /** The modes this student may select (see `resolveStudyModeAccess`). */
  availableModes: StudyMode[];
  /** Whether to offer the mode toggle at all. */
  canChooseMode: boolean;
};

/**
 * THE toggle-eligibility rule, in one place.
 *
 * Three populations, by how they got their access:
 *
 *   FREE (no entitlement at all)
 *     No toggle. Nothing to scope — their access is the fixed mixed sample pool.
 *
 *   PAID (Razorpay subscriptions only)
 *     A mode is selectable only when they own ALL of its subjects. Someone who
 *     bought one or two subjects gets no toggle: their entitlement already scopes
 *     them tighter than any mode would, and every mode would hide something they
 *     paid for.
 *
 *   GRANTED (any live admin_comp / teacher_code grant)
 *     Always gets the toggle. A mode is selectable as long as it leaves them
 *     something — i.e. the intersection with their subjects is non-empty — so a
 *     partial grant can still switch modes without ever landing on a blank app.
 *     The dominant grant shape (`admin_comp` Premium Pro) is all four subjects
 *     anyway, which behaves identically under either rule.
 *
 * Deliberately takes plain inputs rather than a `StudentGate` so both callers can
 * share it: `getStudentScope` (which has a gate) and `withEntitledSubjects` on
 * the serialization path (which has only the derived entitlements and must not
 * re-hit the database). Keeping ONE definition is the point — if these ever
 * disagreed, the UI would offer a toggle the server then refuses.
 */
export function resolveStudyModeAccess(input: {
  role: string | null | undefined;
  /** From getEntitledSubjects — `[]` while the premium surfaces ship dark. */
  entitledSubjects: readonly string[];
  /** True when any live entitlement came from a grant rather than a purchase. */
  hasGrant?: boolean;
}): StudyModeAccess {
  const isStudent = input.role === "student";
  const premiumEnforced = isStudent && isFeatureEnabled("premiumSubscriptions");
  const owned = input.entitledSubjects
    .map((s) => normalizeSubject(s))
    .filter((s): s is Subject => s != null);
  const ownedSubjects = premiumEnforced
    ? ALL_SUBJECTS.filter((s) => owned.includes(s))
    : [...ALL_SUBJECTS];

  const scoped = isStudent && isFeatureEnabled("studyModes");
  if (!scoped) {
    return { ownedSubjects, availableModes: [], canChooseMode: false };
  }

  const availableModes = input.hasGrant
    ? ALL_STUDY_MODES.filter((mode) =>
        studyModeSubjects(mode).some((subject) => ownedSubjects.includes(subject)),
      )
    : availableStudyModes(ownedSubjects);

  return { ownedSubjects, availableModes, canChooseMode: availableModes.length > 0 };
}

/** Scope for a request that must not be narrowed (teachers, admins, flag off). */
function openScope(
  mode: StudyMode,
  explicit: boolean,
  gate: StudentGate,
  access: StudyModeAccess,
): StudentScope {
  return {
    enforced: false,
    mode,
    explicit,
    modeSubjects: [...ALL_SUBJECTS],
    gate,
    ownedSubjects: access.ownedSubjects,
    // No toggle when Study Mode itself is not being enforced — there would be
    // nothing for it to do.
    availableModes: [],
    canChooseMode: false,
    subjects: [...ALL_SUBJECTS],
    starved: false,
  };
}

/**
 * Reads the stored mode for a user, straight from Postgres.
 *
 * Wrapped in React `cache()` so however many surfaces resolve a scope during one
 * request, the database is hit ONCE. That is what makes "always authoritative"
 * affordable: the alternative — trusting `StoredUser.studyMode` off the
 * in-memory store — is a per-lambda snapshot with a 5-minute TTL and was the
 * cause of the mode appearing to flip between values between requests.
 *
 * `explicit: false` means the student has never chosen and we fell back to
 * DEFAULT_STUDY_MODE. Never throws — a storage failure degrades to the default,
 * which is the fully-open mode, so a database blip can never hide content.
 */
export const resolveStudyMode = cache(async function resolveStudyMode(
  userId: string,
): Promise<{ mode: StudyMode; explicit: boolean; prompted: boolean }> {
  if (!userId || !isUserPostgresConfigured()) {
    return { mode: DEFAULT_STUDY_MODE, explicit: false, prompted: false };
  }
  try {
    const row = await dbGetStudyMode(userId);
    const stored = normalizeStudyMode(row?.studyMode);
    return {
      mode: stored ?? DEFAULT_STUDY_MODE,
      explicit: stored != null,
      prompted: row?.promptedAt != null,
    };
  } catch {
    return { mode: DEFAULT_STUDY_MODE, explicit: false, prompted: false };
  }
});

/**
 * Reserved for future options.
 *
 * There used to be a `studyMode` pass-through here so callers holding a
 * `StoredUser` could skip a database round-trip. It was REMOVED: every such
 * caller sources that user from the in-memory store, which is a per-instance
 * 5-minute snapshot, so the "optimisation" was handing the scope a stale mode
 * and was the direct cause of out-of-mode content appearing. `resolveStudyMode`
 * is memoised per request instead, which costs one query and is always correct.
 */
export type StudentScopeOptions = Record<string, never>;

/**
 * The mode to pass as the leading argument of a mode-dependent render loader,
 * so a switch lands on a different `unstable_cache` key.
 *
 * Returns the constant DEFAULT_STUDY_MODE whenever the feature is not in play
 * (flag off, non-student, never chosen) so cache keys do not fragment for users
 * whose content does not vary by mode.
 */
export async function renderStudyModeKey(
  user: { id?: string | null; role?: string | null } | null | undefined,
): Promise<StudyMode> {
  if (!user?.id || user.role !== "student" || !isFeatureEnabled("studyModes")) {
    return DEFAULT_STUDY_MODE;
  }
  return (await resolveStudyMode(user.id)).mode;
}

/**
 * Resolves how Study Mode + premium gating apply to a request.
 *
 * When `options.studyMode` is supplied this costs exactly what `getStudentGate`
 * already cost. Otherwise the mode read runs CONCURRENTLY with the gate read, so
 * the hot path still adds no serial round-trip.
 */
export async function getStudentScope(
  userId: string,
  role: string | null | undefined,
  _options: StudentScopeOptions = {},
): Promise<StudentScope> {
  const scoped = role === "student" && isFeatureEnabled("studyModes");

  const [gate, resolved] = await Promise.all([
    getStudentGate(userId, role),
    scoped
      ? resolveStudyMode(userId)
      : Promise.resolve({ mode: DEFAULT_STUDY_MODE, explicit: false, prompted: false }),
  ]);

  // `gate.subjects` is already the entitlement set; the extra summary read only
  // happens for students under an enforced gate, and only to learn HOW they got
  // access (grant vs purchase). Everyone else short-circuits.
  const hasGrant =
    role === "student" && gate.enforced && gate.anyPremium
      ? (await getEntitlementSummary(userId).catch(() => ({ hasGrant: false }))).hasGrant
      : false;
  const access = resolveStudyModeAccess({ role, entitledSubjects: gate.subjects, hasGrant });

  if (!scoped) {
    return openScope(resolved.mode, resolved.explicit, gate, access);
  }

  const modeSubjects = studyModeSubjects(resolved.mode);
  // The premium gate only narrows when it is actually enforced AND the student
  // owns something; a free student under an enforced gate is handled by the
  // gate's own predicates (free sample pool), not by intersecting to empty here.
  const entitled = gate.enforced && gate.anyPremium ? gate.subjects : ALL_SUBJECTS;
  const subjects = ALL_SUBJECTS.filter(
    (s) => modeSubjects.includes(s) && entitled.includes(s),
  );

  return {
    enforced: true,
    mode: resolved.mode,
    explicit: resolved.explicit,
    modeSubjects,
    gate,
    // Offered as soon as the student owns at least one COMPLETE mode bundle.
    // A one- or two-subject buyer gets no toggle at all (there is no bundle to
    // pick), and a free student gets none either. A single-bundle owner (e.g.
    // P+C+M) still sees it, with the modes they don't own shown disabled — which
    // is also where "you need Biology for NEET Mode" gets said out loud.
    ...access,
    subjects,
    starved: subjects.length === 0,
  };
}

/**
 * Whether a subject-tagged item is visible under a scope.
 *
 * Same contract as the premium-only `subjectVisibleUnderGate` it replaces:
 *  - scope not enforced → always visible;
 *  - `mixed` / `all` / empty / unrecognised subject → always visible;
 *  - otherwise the canonical subject must be in the effective set.
 *
 * The premium half of the decision still runs first, so a free student under an
 * enforced gate is treated exactly as before.
 */
export function subjectVisibleUnderScope(
  subjectRaw: string | null | undefined,
  scope: StudentScope,
): boolean {
  if (!scope.enforced) return true;
  if (scope.gate.enforced && !scope.gate.anyPremium) return false;
  const raw = String(subjectRaw ?? "").trim().toLowerCase();
  if (!raw || raw === "mixed" || raw === "all") return true;
  const canonical = normalizeSubject(raw);
  if (!canonical) return true;
  return scope.subjects.includes(canonical);
}

/**
 * Mode-only subject visibility — ignores premium entitlements entirely.
 *
 * Needed because `subjectVisibleUnderScope` inherits the premium gate's rule
 * that a free student sees NO subject-tagged content, which is right for tests
 * and DPPs but wrong for the OG Code sample pool, where free students
 * legitimately get 500 questions. Use this one wherever free students are meant
 * to see content; use `subjectVisibleUnderScope` wherever premium gating applies
 * too. Getting these two mixed up silently blanks a whole surface.
 */
export function subjectVisibleUnderMode(
  subjectRaw: string | null | undefined,
  scope: StudentScope,
): boolean {
  if (!scope.enforced) return true;
  const raw = String(subjectRaw ?? "").trim().toLowerCase();
  if (!raw || raw === "mixed" || raw === "all") return true;
  const canonical = normalizeSubject(raw);
  if (!canonical) return true;
  return scope.modeSubjects.includes(canonical);
}

/**
 * Intersects a caller-supplied subject list with the scope.
 *
 * Returns `null` when the caller supplied nothing (meaning "no subject filter" —
 * the caller decides whether to substitute `scope.subjects`), and `[]` when a
 * filter was supplied but nothing survived (meaning "this query can only be
 * empty").
 */
export function clampSubjectsToScope(
  requested: readonly string[] | null | undefined,
  scope: StudentScope,
): Subject[] | null {
  if (!requested || requested.length === 0) return null;
  const canonical = requested
    .map((s) => normalizeSubject(s))
    .filter((s): s is Subject => s != null);
  if (!scope.enforced) {
    return ALL_SUBJECTS.filter((s) => canonical.includes(s));
  }
  return scope.subjects.filter((s) => canonical.includes(s));
}

/**
 * The subject list a query should actually run with: the caller's picks clamped
 * to the scope, or the whole scope when the caller supplied no filter.
 */
export function effectiveSubjectsForQuery(
  requested: readonly string[] | null | undefined,
  scope: StudentScope,
): Subject[] {
  return clampSubjectsToScope(requested, scope) ?? [...scope.subjects];
}

/**
 * The subjects filter to hand a catalog query when the caller supplied none —
 * or `null` when the scope does not actually narrow anything.
 *
 * The `null` case matters: passing the full `ALL_SUBJECTS` list as a
 * `subject = ANY(...)` filter is NOT the same as passing no filter. Rows whose
 * subject is outside the four canonical values (legacy imports, odd casing that
 * survived normalisation, `mixed`) would silently disappear from an unscoped
 * request. Only filter when filtering is the point.
 */
export function narrowingSubjectsFilter(scope: StudentScope): Subject[] | null {
  return scope.subjects.length < ALL_SUBJECTS.length ? [...scope.subjects] : null;
}

/**
 * Refuse access to content outside the student's mode. Sets `status = 403` so
 * the API routes' existing `(error as {status?: number}).status === 403` branch
 * maps it to a `forbidden(...)` response — same shape as
 * `throwEntitlementForbidden` in src/legacy/assessments.ts.
 */
export function throwOutOfModeForbidden(
  subjectRaw: string | null | undefined,
  scope: StudentScope,
): never {
  const canonical = normalizeSubject(subjectRaw);
  const label = canonical ? canonical[0].toUpperCase() + canonical.slice(1) : "This subject";
  const err = new Error(
    `${label} is not part of your current study mode. Switch modes to open it.`,
  );
  (err as { status?: number }).status = 403;
  (err as { code?: string }).code = "out_of_study_mode";
  (err as { mode?: StudyMode }).mode = scope.mode;
  throw err;
}
