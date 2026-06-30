/**
 * Admin overview / financials / content aggregates.
 *
 * Read-only COUNT/SUM rollups over the USER Postgres pool (origin_users,
 * app.*, subscriptions.*, content.*) for the admin dashboard, financials, and
 * content surfaces. Every query is individually fault-tolerant: a missing
 * schema/table (e.g. before its runtime-ensure has run) yields 0 instead of a
 * 500, so the dashboard always renders.
 *
 * All money is in **paise (minor units), INR** — format with formatInr().
 */

import "server-only";

import { getUserPostgresPool } from "@/server/user-postgres";

async function scalar(sql: string, params: unknown[] = []): Promise<number> {
  const p = getUserPostgresPool();
  if (!p) return 0;
  try {
    const res = await p.query<{ n: string | number }>(sql, params);
    return Number(res.rows[0]?.n ?? 0);
  } catch {
    return 0;
  }
}

async function rows<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const p = getUserPostgresPool();
  if (!p) return [];
  try {
    const res = await p.query<T>(sql, params);
    return res.rows;
  } catch {
    return [];
  }
}

/** ₹ formatter for paise → e.g. 49900 → "₹499". */
export function formatInr(minor: number, opts?: { withPaise?: boolean }): string {
  const major = minor / 100;
  return `₹${major.toLocaleString("en-IN", {
    minimumFractionDigits: opts?.withPaise ? 2 : 0,
    maximumFractionDigits: opts?.withPaise ? 2 : 0,
  })}`;
}

export type AdminOverviewStats = {
  students: number;
  teachers: number;
  admins: number;
  institutes: number;
  personalWorkspaces: number;
  pendingApprovals: number;
  activeCollaborations: number;
  pendingOgcode: number;
  activeSubscriptions: number;
  /** Monthly recurring revenue from active subject subscriptions, in paise. */
  mrrMinor: number;
};

export async function getAdminOverviewStats(): Promise<AdminOverviewStats> {
  const [
    students,
    teachers,
    admins,
    institutes,
    personalWorkspaces,
    pendingApprovals,
    activeCollaborations,
    pendingOgcode,
    activeSubscriptions,
    mrrMinor,
  ] = await Promise.all([
    scalar(`SELECT COUNT(*)::int AS n FROM origin_users WHERE role = 'student'`),
    scalar(`SELECT COUNT(*)::int AS n FROM origin_users WHERE role = 'teacher'`),
    scalar(`SELECT COUNT(*)::int AS n FROM origin_users WHERE role = 'admin'`),
    scalar(`SELECT COUNT(*)::int AS n FROM app.teacher_workspaces WHERE workspace_type = 'institute'`),
    scalar(`SELECT COUNT(*)::int AS n FROM app.teacher_workspaces WHERE workspace_type = 'personal'`),
    scalar(`SELECT COUNT(*)::int AS n FROM app.origin_collaborations WHERE status = 'pending'`),
    scalar(`SELECT COUNT(*)::int AS n FROM app.origin_collaborations WHERE status = 'active'`),
    scalar(`SELECT COUNT(*)::int AS n FROM content.ogcode_publications WHERE status = 'submitted'`),
    scalar(`SELECT COUNT(*)::int AS n FROM subscriptions.user_subscriptions WHERE status = 'active'`),
    scalar(`SELECT COALESCE(SUM(amount_minor), 0)::bigint AS n FROM subscriptions.user_subscriptions WHERE status = 'active'`),
  ]);
  return {
    students,
    teachers,
    admins,
    institutes,
    personalWorkspaces,
    pendingApprovals,
    activeCollaborations,
    pendingOgcode,
    activeSubscriptions,
    mrrMinor,
  };
}

export type SubjectRevenueRow = { subject: string; subs: number; mrrMinor: number };

export type AdminFinancials = {
  mrrMinor: number;
  activeSubscriptions: number;
  bySubject: SubjectRevenueRow[];
  /** Enrollment-order revenue (one-time + Flow-2), paise, paid orders only. */
  paidOrdersMinor: number;
  paidOrders: number;
};

export async function getAdminFinancials(): Promise<AdminFinancials> {
  const [bySubject, agg, ordersAgg] = await Promise.all([
    rows<{ subject: string; subs: number; mrr: string }>(
      `SELECT subject, COUNT(*)::int AS subs, COALESCE(SUM(amount_minor), 0)::bigint AS mrr
         FROM subscriptions.user_subscriptions
        WHERE status = 'active'
        GROUP BY subject
        ORDER BY subject`,
    ),
    rows<{ subs: number; mrr: string }>(
      `SELECT COUNT(*)::int AS subs, COALESCE(SUM(amount_minor), 0)::bigint AS mrr
         FROM subscriptions.user_subscriptions WHERE status = 'active'`,
    ),
    rows<{ orders: number; total: string }>(
      `SELECT COUNT(*)::int AS orders, COALESCE(SUM(amount_minor), 0)::bigint AS total
         FROM commerce.enrollment_orders WHERE status = 'paid'`,
    ),
  ]);
  return {
    mrrMinor: Number(agg[0]?.mrr ?? 0),
    activeSubscriptions: Number(agg[0]?.subs ?? 0),
    bySubject: bySubject.map((r) => ({ subject: r.subject, subs: Number(r.subs), mrrMinor: Number(r.mrr) })),
    paidOrdersMinor: Number(ordersAgg[0]?.total ?? 0),
    paidOrders: Number(ordersAgg[0]?.orders ?? 0),
  };
}

export type AdminContentStats = {
  totalQuestions: number;
  readyQuestions: number;
  ogcodeSubmitted: number;
  ogcodePublished: number;
};

export async function getAdminContentStats(): Promise<AdminContentStats> {
  const [totalQuestions, readyQuestions, ogcodeSubmitted, ogcodePublished] = await Promise.all([
    scalar(`SELECT COUNT(*)::int AS n FROM content.questions`),
    scalar(`SELECT COUNT(*)::int AS n FROM content.questions WHERE status = 'ready'`),
    scalar(`SELECT COUNT(*)::int AS n FROM content.ogcode_publications WHERE status = 'submitted'`),
    scalar(`SELECT COUNT(*)::int AS n FROM content.ogcode_publications WHERE status = 'published'`),
  ]);
  return { totalQuestions, readyQuestions, ogcodeSubmitted, ogcodePublished };
}
