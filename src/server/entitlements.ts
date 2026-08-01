/**
 * DB-backed entitlement source of truth — Phase 1.3.
 *
 * `entitledSubjects` is DERIVED at read time from active rows in
 * subscriptions.user_subscriptions; it is never a second stored column.
 * The legacy origin_users.is_premium / premium_expiry columns are kept as
 * denormalised mirrors recomputed on every webhook via
 * `recomputeUserPremiumFlags`.
 *
 * Pure, client-safe predicates (hasAnyPremium, canAccessSubject,
 * canAccessFeature, ...) live in `src/lib/entitlements.ts` and are re-exported
 * here so server code has a single import surface.
 *
 * See PREMIUM_AND_TEACHER_CONNECTION_PLAN.md (Phase 1.3).
 */

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";
import { invalidateUserAiContext, invalidateUserAiContexts } from "@/server/ai-access";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { dbUpdateUser } from "@/server/db-users";
import type { StoredUser } from "@/legacy/store";
import { ensureSubscriptionsSchema } from "@/server/subscriptions/subscriptions-schema";
import { getActiveSubjectGrantRows } from "@/server/connect/subject-grants-store";
import { ALL_SUBJECTS, hasAnyPremium, isSubject, type Subject } from "@/lib/entitlements";

export * from "@/lib/entitlements";

function pool() {
  return getUserPostgresPool();
}

/**
 * SQL predicate (over a subscriptions.user_subscriptions row) for "currently
 * entitled". A subject is entitled while its billing period has not lapsed:
 *   - `active`            — the normal paid state.
 *   - `pending`/`halted`  — payment retry in progress; keep access to period end.
 *   - `cancelled`         — cancel_at_cycle_end; keep access to period end.
 * `created`/`authenticated` (never charged), `completed` and `expired` never
 * grant access. The reconciliation cron flips lapsed rows to `expired`.
 *
 * NOTE: this refines the literal `status='active'` query sketched in the plan
 * so that the grace-to-period-end behaviour (plan Risk #2) is actually honoured
 * while still recording the precise Razorpay status. See PLAN Phase 1.1/1.3.
 */
const ENTITLED_CLAUSE = `(
  (status = 'active' AND (current_period_end IS NULL OR current_period_end > NOW()))
  OR (status IN ('pending', 'halted', 'cancelled')
      AND current_period_end IS NOT NULL AND current_period_end > NOW())
)`;

/** A subject + its expiry (NULL = never), as resolved from one entitlement source. */
type EntitlementRow = {
  subject: Subject;
  expiresAt: string | null;
  /** Where the access came from — a paid subscription or an admin/teacher grant. */
  source: "subscription" | "grant";
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

/** Active, non-lapsed Razorpay subject subscriptions (standalone + Flow-2 add-ons). */
async function getSubscriptionEntitlementRows(userId: string): Promise<EntitlementRow[]> {
  await ensureSubscriptionsSchema();
  const p = pool();
  if (!p) return [];
  const res = await p.query<{ subject: string; current_period_end: Date | string | null }>(
    `SELECT subject, current_period_end
       FROM subscriptions.user_subscriptions
      WHERE user_id = $1 AND ${ENTITLED_CLAUSE}`,
    [userId],
  );
  return res.rows
    .filter((r) => isSubject(r.subject))
    .map((r) => ({
      subject: r.subject as Subject,
      expiresAt: toIso(r.current_period_end),
      source: "subscription" as const,
    }));
}

/**
 * The UNION of every live entitlement for a user — Phase 14 (section C):
 *   (a) active subscriptions.user_subscriptions (standalone + Flow-2 add-ons), and
 *   (b) active entitlements.subject_grants (Flow-1 teacher_code + admin_comp).
 * Both queries run in parallel; rows are merged (deduped downstream per subject).
 * No feature-flag gate — the recompute path must see grants even while the flags
 * ship dark (e.g. the cutover backfill in production). The flag gate lives in the
 * hot read path (getEntitledSubjects) only.
 */
async function getActiveEntitlementRows(userId: string): Promise<EntitlementRow[]> {
  if (!userId || !isUserPostgresConfigured()) return [];
  const [subscriptions, grants] = await Promise.all([
    getSubscriptionEntitlementRows(userId),
    getActiveSubjectGrantRows(userId),
  ]);
  return [...subscriptions, ...grants.map((g) => ({ ...g, source: "grant" as const }))];
}

/**
 * The subjects a user is currently entitled to: the UNION of active subscriptions
 * and active subject grants whose access has not lapsed. Returns canonical-order,
 * deduped subjects. Falls back to `[]` when Postgres is not configured.
 */
export async function getEntitledSubjects(userId: string): Promise<Subject[]> {
  return (await getEntitlementSummary(userId)).subjects;
}

/**
 * `getEntitledSubjects` plus HOW the access was obtained.
 *
 * `hasGrant` is true when any live entitlement came from `entitlements.subject_grants`
 * — an `admin_comp` comp (Premium Pro / Event Mode) or a Flow-1 `teacher_code`
 * unlock — rather than a paid Razorpay subscription. Study Mode uses it to treat
 * granted students more permissively than partial purchasers (see
 * `resolveStudyModeAccess`).
 *
 * Costs nothing extra: `getActiveEntitlementRows` already fetches both sources in
 * parallel and was simply discarding which was which.
 */
export async function getEntitlementSummary(
  userId: string,
): Promise<{ subjects: Subject[]; hasGrant: boolean }> {
  if (!userId || !isUserPostgresConfigured()) return { subjects: [], hasGrant: false };
  // While BOTH premium surfaces ship dark, keep this off the hot path entirely —
  // no DB round-trip on every user serialization and no premature schema creation.
  // Gating (getStudentGate) keeps access open in that state regardless.
  if (!isFeatureEnabled("premiumSubscriptions") && !isFeatureEnabled("teacherConnect")) {
    return { subjects: [], hasGrant: false };
  }
  const rows = await getActiveEntitlementRows(userId);
  const owned = new Set(rows.map((r) => r.subject));
  return {
    subjects: ALL_SUBJECTS.filter((s) => owned.has(s)),
    hasGrant: rows.some((r) => r.source === "grant"),
  };
}

/**
 * Enriches a serialized user payload with its derived `entitledSubjects`, plus
 * the Study Mode toggle eligibility that follows from them.
 *
 * Used at every client-facing serialization exit (login/register/me/refresh and
 * the RSC seed) so `useAuth().user` and server gates agree. Study Mode
 * eligibility rides along here rather than being computed on the client because
 * the rule depends on feature flags the browser never sees — and because a
 * client that disagreed with the server would render a toggle the server then
 * refuses. `resolveStudyModeAccess` is the single shared definition.
 */
export async function withEntitledSubjects<T extends Record<string, unknown>>(
  payload: T,
  userId: string,
): Promise<
  T & {
    entitledSubjects: Subject[];
    studyModeAvailable: boolean;
    availableStudyModes: string[];
    studyMode?: string | null;
    studyModePrompted?: boolean;
  }
> {
  const { subjects: entitledSubjects, hasGrant } = await getEntitlementSummary(userId);
  // Imported lazily: study-scope imports back from this module (getStudentGate),
  // so a top-level import would close a cycle.
  const { resolveStudyModeAccess, resolveStudyMode } = await import("@/server/study-scope");
  const role = typeof payload.role === "string" ? payload.role : null;
  const access = resolveStudyModeAccess({ role, entitledSubjects, hasGrant });

  // Study Mode is re-read from Postgres and OVERRIDES whatever `serializeUser`
  // put in the payload. That value comes from the in-memory store — a
  // per-lambda-instance snapshot with a 5-minute TTL — so on a serverless fleet
  // it is routinely behind the student's latest choice. Serving it to the client
  // is what made the toggle appear to jump back to a previous mode (or to PCMB,
  // when the stale row still had NULL). This is the single serialization exit
  // for login / register / me / refresh / RSC seed, so overriding here fixes all
  // of them at once.
  const stored = role === "student" ? await resolveStudyMode(userId) : null;

  return {
    ...payload,
    entitledSubjects,
    studyModeAvailable: access.canChooseMode,
    availableStudyModes: access.availableModes,
    ...(stored
      ? {
          studyMode: stored.explicit ? stored.mode : null,
          study_mode: stored.explicit ? stored.mode : null,
          studyModePrompted: stored.prompted,
          study_mode_prompted: stored.prompted,
        }
      : {}),
  };
}

/**
 * RSC page gate: should a free student be redirected to /premium? True only
 * when the feature is enabled, the caller is a student, and they own no
 * subject. Teachers/admins and the dark state are never redirected.
 */
export function shouldRedirectFreeStudent(
  user: { role?: string | null; entitledSubjects?: ReadonlyArray<string> | null } | null | undefined,
): boolean {
  if (!user || user.role !== "student") return false;
  if (!isFeatureEnabled("premiumSubscriptions")) return false;
  return !hasAnyPremium(user);
}

export type StudentGate = {
  /** True when premium gating actually applies (flag on AND the user is a student). */
  enforced: boolean;
  /** Subjects the student is entitled to (empty when free or not enforced). */
  subjects: Subject[];
  /** True when the student owns any subject — unlocks the global features. */
  anyPremium: boolean;
};

/**
 * Resolves how premium gating applies to a request. When the flag is off or the
 * caller is not a student, `enforced` is false and callers must leave access
 * fully open (today's behaviour). Otherwise it carries the entitled subjects so
 * server-side content filters can scope lists to what the student owns.
 */
export async function getStudentGate(
  userId: string,
  role: string | null | undefined,
): Promise<StudentGate> {
  if (role !== "student" || !isFeatureEnabled("premiumSubscriptions")) {
    return { enforced: false, subjects: [], anyPremium: true };
  }
  const subjects = await getEntitledSubjects(userId);
  return { enforced: true, subjects, anyPremium: subjects.length > 0 };
}

async function revalidateUserCache(userId: string): Promise<void> {
  // revalidateTag is only valid inside a Next request/render scope. The webhook
  // route runs in that scope; the reconciliation cron and integration tests do
  // not, so failures here are expected and safe to swallow.
  try {
    const { revalidateTag } = await import("next/cache");
    revalidateTag(`user:${userId}`, "max");
    revalidateTag("auth-user", "max");
  } catch {
    /* not in a request scope — nothing to revalidate */
  }
}

/**
 * Recomputes the denormalised origin_users.is_premium / premium_expiry mirrors
 * from the authoritative entitlement UNION (subscriptions + subject grants), then
 * revalidates the user/auth caches so RSC + useAuth() pick up the new entitlement.
 * Called after every subscription/connect webhook transition, after grant/revoke,
 * during the cutover backfill, and from the reconciliation cron. No feature-flag
 * gate — the mirror must stay correct even while the surfaces ship dark.
 *
 * `is_premium` = distinct entitled subject count > 0. `premium_expiry` = NULL when
 * any active entitlement never expires (e.g. an admin_comp grant), otherwise the
 * latest finite expiry across the union.
 */
export async function recomputeUserPremiumFlags(userId: string): Promise<void> {
  if (!userId || !isUserPostgresConfigured()) return;
  const rows = await getActiveEntitlementRows(userId);
  const subjects = new Set(rows.map((r) => r.subject));
  const isPremium = subjects.size > 0;

  let premiumExpiry: string | null = null;
  if (isPremium) {
    const hasNeverExpires = rows.some((r) => r.expiresAt === null);
    if (!hasNeverExpires) {
      const latestMs = rows
        .map((r) => Date.parse(r.expiresAt as string))
        .filter((ms) => Number.isFinite(ms))
        .reduce((max, ms) => (ms > max ? ms : max), Number.NEGATIVE_INFINITY);
      premiumExpiry = Number.isFinite(latestMs) ? new Date(latestMs).toISOString() : null;
    }
  }

  await dbUpdateUser(userId, { isPremium, premiumExpiry } as Partial<StoredUser>);
  await revalidateUserCache(userId);
  // AI Feature Toggle epic — tier (is_premium) changed; drop the cached uctx so
  // any tier-scoped rule re-resolves immediately rather than in ≤120s (doc 03 §6).
  void invalidateUserAiContext(userId).catch(() => {});
}

/**
 * Set-based sibling of `recomputeUserPremiumFlags` for bulk admin operations
 * (e.g. granting/revoking Premium Pro comp to thousands of free students at once
 * from /admin/premium-access). Recomputes is_premium / premium_expiry for every
 * given user in ONE statement per ~5k-id chunk — the exact same semantics as the
 * single-user path (ENTITLED_CLAUSE for paid subs + active grants; is_premium =
 * owns ≥1 subject; premium_expiry = NULL when any active entitlement never
 * expires, else the latest finite expiry). Never loops the per-user recompute.
 * No feature-flag gate — the mirror must stay correct even while surfaces are dark.
 */
export async function recomputePremiumFlagsForUsers(userIds: string[]): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return;
  const p = pool();
  if (!p) return;

  const CHUNK = 5000;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    await p.query(
      `WITH affected AS (SELECT unnest($1::text[]) AS user_id),
       ent AS (
         SELECT s.user_id, s.current_period_end AS expires_at
           FROM subscriptions.user_subscriptions s
           JOIN affected f ON f.user_id = s.user_id
          WHERE s.subject IN ('physics', 'chemistry', 'mathematics', 'biology')
            AND ${ENTITLED_CLAUSE}
         UNION ALL
         SELECT g.user_id, g.expires_at
           FROM entitlements.subject_grants g
           JOIN affected f ON f.user_id = g.user_id
          WHERE g.status = 'active'
            AND g.subject IN ('physics', 'chemistry', 'mathematics', 'biology')
            AND (g.expires_at IS NULL OR g.expires_at > NOW())
       ),
       agg AS (
         SELECT user_id,
                BOOL_OR(expires_at IS NULL) AS has_never_expires,
                MAX(expires_at)             AS latest_expiry
           FROM ent GROUP BY user_id
       )
       UPDATE origin_users u
          SET is_premium     = (a.user_id IS NOT NULL),
              premium_expiry = CASE WHEN a.user_id IS NULL OR a.has_never_expires THEN NULL
                                    ELSE a.latest_expiry END
         FROM affected f
         LEFT JOIN agg a ON a.user_id = f.user_id
        WHERE u.id = f.user_id`,
      [chunk],
    );
  }

  // Propagate: small batches per-user (precise), large batches once + bulk uctx
  // drop (the ≤120s uctx TTL is the backstop either way).
  if (ids.length <= 100) {
    for (const id of ids) {
      await revalidateUserCache(id);
      void invalidateUserAiContext(id).catch(() => {});
    }
  } else {
    try {
      const { revalidateTag } = await import("next/cache");
      revalidateTag("auth-user", "max");
    } catch {
      /* not in a request scope — nothing to revalidate */
    }
    void invalidateUserAiContexts(ids).catch(() => {});
  }
}
