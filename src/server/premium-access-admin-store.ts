/**
 * Read side for the /admin/premium-access console — tier counts + the student
 * roster with a per-student plan label. The plan label is DERIVED (not read from
 * the is_premium mirror) so the admin can tell a real Razorpay payer apart from an
 * admin-granted comp:
 *
 *   paid    → an active, non-lapsed subscriptions.user_subscriptions row
 *   comp    → an active admin_comp entitlements.subject_grants row (admin-granted)
 *   teacher → an active teacher_code grant
 *   free    → none of the above
 *
 * Priority when a student has more than one source: paid > comp > teacher > free.
 * Paid is checked first and is what the UI marks "protected" — the toggle never
 * touches subscriptions.user_subscriptions, so a payer can never be demoted.
 */

import type { Pool } from "pg";

import { getUserPostgresPool } from "@/server/user-postgres";
import { ensureSubjectGrantsSchema } from "@/server/connect/subject-grants-schema";
import { ensureSubscriptionsSchema } from "@/server/subscriptions/subscriptions-schema";
import { ALL_SUBJECTS, type Subject } from "@/lib/entitlements";

export type PlanKey = "paid" | "comp" | "teacher" | "free";
export type PlanFilter = PlanKey | "premium" | "all";

export type PremiumPlanCounts = {
  totalStudents: number;
  free: number;
  paid: number;
  comp: number;
  teacher: number;
};

export type PremiumRosterRow = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  plan: PlanKey;
  isPremium: boolean;
  premiumExpiry: string | null;
  compExpiresAt: string | null;
  joinedAt: string;
};

function pool(): Pool {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

async function ensureSchemas(): Promise<void> {
  await Promise.all([ensureSubjectGrantsSchema(), ensureSubscriptionsSchema()]);
}

// "Currently entitled" paid subscription — verbatim from entitlements.ts
// ENTITLED_CLAUSE (active, or grace-to-period-end for pending/halted/cancelled).
// `status`/`current_period_end` resolve to the `s` alias (the only table with
// those columns in the EXISTS subquery below).
const PAID_ENTITLED = `(
  (status = 'active' AND (current_period_end IS NULL OR current_period_end > NOW()))
  OR (status IN ('pending', 'halted', 'cancelled')
      AND current_period_end IS NOT NULL AND current_period_end > NOW())
)`;

// The per-student derived flags. Computed once per row inside a CTE so both the
// counts aggregate and the roster page share one definition.
const FLAG_COLUMNS = `
  u.id, u.name, u.username, u.email, u.joined_at, u.is_premium, u.premium_expiry,
  EXISTS(
    SELECT 1 FROM subscriptions.user_subscriptions s
     WHERE s.user_id = u.id
       AND s.subject IN ('physics', 'chemistry', 'mathematics', 'biology')
       AND ${PAID_ENTITLED}
  ) AS has_paid,
  EXISTS(
    SELECT 1 FROM entitlements.subject_grants g
     WHERE g.user_id = u.id AND g.source = 'admin_comp' AND g.status = 'active'
       AND (g.expires_at IS NULL OR g.expires_at > NOW())
  ) AS has_comp,
  EXISTS(
    SELECT 1 FROM entitlements.subject_grants g
     WHERE g.user_id = u.id AND g.source = 'teacher_code' AND g.status = 'active'
       AND (g.expires_at IS NULL OR g.expires_at > NOW())
  ) AS has_teacher,
  (SELECT MAX(g.expires_at) FROM entitlements.subject_grants g
     WHERE g.user_id = u.id AND g.source = 'admin_comp' AND g.status = 'active') AS comp_expires_at
`;

/** WHERE predicate (over the flag CTE) for a plan filter; null = no extra filter. */
function planPredicate(plan: PlanFilter): string | null {
  switch (plan) {
    case "paid":
      return "has_paid";
    case "comp":
      return "has_comp AND NOT has_paid";
    case "teacher":
      return "has_teacher AND NOT has_paid AND NOT has_comp";
    case "free":
      return "NOT has_paid AND NOT has_comp AND NOT has_teacher";
    case "premium":
      return "is_premium = TRUE";
    case "all":
    default:
      return null;
  }
}

/** Plan label from the derived per-student flags. Priority: paid > comp > teacher > free. */
export function planFromFlags(row: {
  has_paid?: unknown;
  has_comp?: unknown;
  has_teacher?: unknown;
}): PlanKey {
  if (row.has_paid) return "paid";
  if (row.has_comp) return "comp";
  if (row.has_teacher) return "teacher";
  return "free";
}

function rowToRoster(row: Record<string, unknown>): PremiumRosterRow {
  return {
    id: row.id as string,
    name: (row.name as string) ?? "",
    username: (row.username as string | null) ?? null,
    email: (row.email as string) ?? "",
    plan: planFromFlags(row),
    isPremium: Boolean(row.is_premium),
    premiumExpiry: row.premium_expiry ? new Date(row.premium_expiry as string).toISOString() : null,
    compExpiresAt: row.comp_expires_at ? new Date(row.comp_expires_at as string).toISOString() : null,
    joinedAt: new Date(row.joined_at as string).toISOString(),
  };
}

/** Student counts split by plan (one pass over students; flags computed once). */
export async function getPremiumPlanCounts(): Promise<PremiumPlanCounts> {
  await ensureSchemas();
  const res = await pool().query(
    `WITH base AS (
       SELECT ${FLAG_COLUMNS}
       FROM origin_users u
       WHERE u.role = 'student'
     )
     SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE has_paid)::int AS paid,
       COUNT(*) FILTER (WHERE has_comp AND NOT has_paid)::int AS comp,
       COUNT(*) FILTER (WHERE has_teacher AND NOT has_paid AND NOT has_comp)::int AS teacher,
       COUNT(*) FILTER (WHERE NOT has_paid AND NOT has_comp AND NOT has_teacher)::int AS free
     FROM base`,
  );
  const r = res.rows[0] ?? {};
  return {
    totalStudents: Number(r.total ?? 0),
    paid: Number(r.paid ?? 0),
    comp: Number(r.comp ?? 0),
    teacher: Number(r.teacher ?? 0),
    free: Number(r.free ?? 0),
  };
}

export type SubjectAccessRow = {
  subject: Subject;
  /** Owned via a real Razorpay subscription — protected, never toggleable here. */
  paid: boolean;
  /** Owned via an active teacher_code grant, and which workspace granted it (protected, informational). */
  teacherWorkspaceId: string | null;
  /** Owned via an active admin_comp grant — the only dimension "Manage subjects" can toggle. */
  comp: boolean;
  compExpiresAt: string | null;
};

/**
 * Per-subject ownership breakdown for ONE student, across all three entitlement
 * sources — powers the admin "Manage subjects" control (grant/revoke individual
 * subjects, not just the full 4-subject bundle). A subject already owned via
 * `paid` or `teacher_code` is surfaced as protected/informational so the admin
 * can see the full picture without being able to accidentally revoke a real
 * subscription or a teacher's free-subject grant from here.
 */
// Same predicate as PAID_ENTITLED above, qualified with the "sub" alias — this
// query's outer FROM is the subject VALUES list, not user_subscriptions, so the
// bare-column version isn't reusable here.
const PAID_ENTITLED_SUB = `(
  (sub.status = 'active' AND (sub.current_period_end IS NULL OR sub.current_period_end > NOW()))
  OR (sub.status IN ('pending', 'halted', 'cancelled')
      AND sub.current_period_end IS NOT NULL AND sub.current_period_end > NOW())
)`;

export async function getStudentSubjectAccess(userId: string): Promise<SubjectAccessRow[]> {
  await ensureSchemas();
  const res = await pool().query(
    `SELECT
       s.subject,
       EXISTS(
         SELECT 1 FROM subscriptions.user_subscriptions sub
          WHERE sub.user_id = $1 AND sub.subject = s.subject AND ${PAID_ENTITLED_SUB}
       ) AS paid,
       (
         SELECT g.workspace_id FROM entitlements.subject_grants g
          WHERE g.user_id = $1 AND g.subject = s.subject AND g.source = 'teacher_code' AND g.status = 'active'
            AND (g.expires_at IS NULL OR g.expires_at > NOW())
          LIMIT 1
       ) AS teacher_workspace_id,
       EXISTS(
         SELECT 1 FROM entitlements.subject_grants g
          WHERE g.user_id = $1 AND g.subject = s.subject AND g.source = 'admin_comp' AND g.status = 'active'
            AND (g.expires_at IS NULL OR g.expires_at > NOW())
       ) AS comp,
       (
         SELECT g.expires_at FROM entitlements.subject_grants g
          WHERE g.user_id = $1 AND g.subject = s.subject AND g.source = 'admin_comp' AND g.status = 'active'
          LIMIT 1
       ) AS comp_expires_at
     FROM (VALUES ('physics'), ('chemistry'), ('mathematics'), ('biology')) AS s(subject)`,
    [userId],
  );
  const bySubject = new Map(
    res.rows.map((row) => [
      row.subject as string,
      {
        subject: row.subject as Subject,
        paid: Boolean(row.paid),
        teacherWorkspaceId: (row.teacher_workspace_id as string | null) ?? null,
        comp: Boolean(row.comp),
        compExpiresAt: row.comp_expires_at ? new Date(row.comp_expires_at as string).toISOString() : null,
      },
    ]),
  );
  return ALL_SUBJECTS.map(
    (subject) =>
      bySubject.get(subject) ?? {
        subject,
        paid: false,
        teacherWorkspaceId: null,
        comp: false,
        compExpiresAt: null,
      },
  );
}

/** A page of the student roster filtered by plan (+ optional name/email search). */
export async function listStudentsByPlan(input: {
  plan: PlanFilter;
  query?: string;
  limit: number;
  offset: number;
}): Promise<{ students: PremiumRosterRow[]; total: number }> {
  await ensureSchemas();
  const params: unknown[] = [];
  let searchClause = "";
  if (input.query && input.query.trim()) {
    params.push(`%${input.query.trim()}%`);
    searchClause = `AND (u.name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR u.username ILIKE $${params.length})`;
  }
  const predicate = planPredicate(input.plan);
  const outerWhere = predicate ? `WHERE ${predicate}` : "";
  const cte = `WITH base AS (
       SELECT ${FLAG_COLUMNS}
       FROM origin_users u
       WHERE u.role = 'student' ${searchClause}
     )`;

  const totalRes = await pool().query(`${cte} SELECT COUNT(*)::int AS total FROM base ${outerWhere}`, params);

  const pageParams = [...params, input.limit, input.offset];
  const res = await pool().query(
    `${cte}
     SELECT * FROM base ${outerWhere}
     ORDER BY joined_at DESC
     LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length}`,
    pageParams,
  );

  return {
    students: res.rows.map(rowToRoster),
    total: Number(totalRes.rows[0]?.total ?? 0),
  };
}
