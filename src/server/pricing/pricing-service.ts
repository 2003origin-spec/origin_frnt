/**
 * Admin Control Plane — pricing service.
 *
 * Source of truth for the per-subject price and the all-subjects bundle offer.
 * Reads resolve to the admin-set DB value, falling back to the legacy constant +
 * env plan id when no override exists. Writes (admin-only) create a fresh Razorpay
 * plan at the new amount so NEW subscriptions bill the new price; existing
 * subscriptions are untouched (new-subscriptions-only policy).
 */

import "server-only";

import { getUserPostgresPool } from "@/server/user-postgres";
import { getRazorpayClient } from "@/server/payments/razorpay-client";
import { SUBJECT_PRICE_MINOR, planEnvVarFor } from "@/server/payments/subject-plans";
import { createPrefixedId } from "@/server/workspaces/ids";
import { ALL_SUBJECTS, type Subject } from "@/lib/entitlements";

import { ensurePricingSchema } from "./pricing-schema";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

export type ResolvedSubjectPrice = {
  subject: Subject;
  amountMinor: number;
  razorpayPlanId: string | null;
  /** True when an admin override row exists (vs. the legacy fallback). */
  overridden: boolean;
};

function envPlanId(subject: Subject): string | null {
  return process.env[planEnvVarFor(subject)]?.trim() || null;
}

/** Resolve the effective price + plan id for one subject (DB override or fallback). */
export async function getSubjectPriceResolved(subject: Subject): Promise<ResolvedSubjectPrice> {
  await ensurePricingSchema();
  const res = await pool().query<{ amount_minor: number; razorpay_plan_id: string | null }>(
    `SELECT amount_minor, razorpay_plan_id FROM pricing.subject_prices WHERE subject = $1`,
    [subject],
  );
  if (res.rows[0]) {
    return {
      subject,
      amountMinor: Number(res.rows[0].amount_minor),
      razorpayPlanId: res.rows[0].razorpay_plan_id ?? envPlanId(subject),
      overridden: true,
    };
  }
  return { subject, amountMinor: SUBJECT_PRICE_MINOR, razorpayPlanId: envPlanId(subject), overridden: false };
}

export type BundleOffer = {
  id: string;
  name: string;
  subjects: string[];
  amountMinor: number;
  currency: string;
  razorpayPlanId: string | null;
  active: boolean;
};

function rowToBundle(row: Record<string, unknown>): BundleOffer {
  return {
    id: row.id as string,
    name: row.name as string,
    subjects: (row.subjects as string[]) ?? [],
    amountMinor: Number(row.amount_minor) || 0,
    currency: (row.currency as string) ?? "INR",
    razorpayPlanId: (row.razorpay_plan_id as string | null) ?? null,
    active: Boolean(row.active),
  };
}

export async function getActiveBundle(): Promise<BundleOffer | null> {
  await ensurePricingSchema();
  const res = await pool().query(
    `SELECT * FROM pricing.bundle_offers WHERE active = TRUE ORDER BY updated_at DESC LIMIT 1`,
  );
  return res.rows[0] ? rowToBundle(res.rows[0]) : null;
}

/** Student-facing pricing snapshot: live subject prices + the active bundle. */
export async function getPublicPricing(): Promise<{
  subjects: { subject: Subject; amountMinor: number }[];
  bundle: { name: string; subjects: string[]; amountMinor: number } | null;
}> {
  const subjects = await Promise.all(
    ALL_SUBJECTS.map(async (s) => {
      const r = await getSubjectPriceResolved(s);
      return { subject: s, amountMinor: r.amountMinor };
    }),
  );
  const bundle = await getActiveBundle();
  return {
    subjects,
    bundle: bundle ? { name: bundle.name, subjects: bundle.subjects, amountMinor: bundle.amountMinor } : null,
  };
}

/** Admin view: every subject's effective price + the active bundle. */
export async function getAdminPricing(): Promise<{
  subjects: ResolvedSubjectPrice[];
  bundle: BundleOffer | null;
}> {
  const subjects = await Promise.all(ALL_SUBJECTS.map((s) => getSubjectPriceResolved(s)));
  const bundle = await getActiveBundle();
  return { subjects, bundle };
}

/** Creates a monthly Razorpay plan at the given amount (paise). */
export async function createMonthlyPlan(name: string, amountMinor: number, notes: Record<string, string>): Promise<string> {
  const client = getRazorpayClient();
  const plan = await client.plans.create({
    period: "monthly",
    interval: 1,
    item: { name: name.slice(0, 255), amount: amountMinor, currency: "INR" },
    notes,
  } as Parameters<typeof client.plans.create>[0]);
  return plan.id;
}

/**
 * Admin: set a subject's monthly price. Creates a new Razorpay plan at the new
 * amount (so new subscriptions bill it) and stores both. Throws if Razorpay is
 * not configured — you cannot change the effective price without a plan.
 */
export async function setSubjectPrice(input: {
  subject: Subject;
  amountMinor: number;
  adminUserId: string;
}): Promise<ResolvedSubjectPrice> {
  await ensurePricingSchema();
  const planId = await createMonthlyPlan(
    `Origin Premium — ${input.subject} (₹${(input.amountMinor / 100).toFixed(0)}/mo)`,
    input.amountMinor,
    { origin_kind: "subject_price", origin_subject: input.subject },
  );
  await pool().query(
    `INSERT INTO pricing.subject_prices (subject, amount_minor, razorpay_plan_id, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (subject) DO UPDATE SET
       amount_minor = EXCLUDED.amount_minor,
       razorpay_plan_id = EXCLUDED.razorpay_plan_id,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()`,
    [input.subject, input.amountMinor, planId, input.adminUserId],
  );
  return getSubjectPriceResolved(input.subject);
}

/**
 * Admin: create or update the active bundle offer. Creates a Razorpay plan at the
 * bundle amount. There is a single active bundle at a time — setting one active
 * deactivates the others.
 */
export async function upsertBundle(input: {
  id?: string;
  name: string;
  subjects: string[];
  amountMinor: number;
  active: boolean;
  adminUserId: string;
}): Promise<BundleOffer> {
  await ensurePricingSchema();
  const id = input.id ?? createPrefixedId("bundle");
  const planId = input.active
    ? await createMonthlyPlan(
        `Origin Premium — All subjects bundle (₹${(input.amountMinor / 100).toFixed(0)}/mo)`,
        input.amountMinor,
        { origin_kind: "bundle_price" },
      )
    : null;

  if (input.active) {
    await pool().query(`UPDATE pricing.bundle_offers SET active = FALSE, updated_at = NOW() WHERE active = TRUE AND id <> $1`, [id]);
  }

  const res = await pool().query(
    `INSERT INTO pricing.bundle_offers (id, name, subjects, amount_minor, razorpay_plan_id, active, updated_by, updated_at)
     VALUES ($1, $2, $3::text[], $4, $5, $6, $7, NOW())
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       subjects = EXCLUDED.subjects,
       amount_minor = EXCLUDED.amount_minor,
       razorpay_plan_id = COALESCE(EXCLUDED.razorpay_plan_id, pricing.bundle_offers.razorpay_plan_id),
       active = EXCLUDED.active,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()
     RETURNING *`,
    [id, input.name, input.subjects, input.amountMinor, planId, input.active, input.adminUserId],
  );
  return rowToBundle(res.rows[0]);
}
