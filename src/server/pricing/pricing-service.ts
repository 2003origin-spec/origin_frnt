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
import { getRazorpayClient, isLivemode, isRazorpayConfigured } from "@/server/payments/razorpay-client";
import { SUBJECT_PRICE_MINOR, planEnvVarFor } from "@/server/payments/subject-plans";
import { createPrefixedId } from "@/server/workspaces/ids";
import { ALL_SUBJECTS, isSubject, type Subject } from "@/lib/entitlements";

import { ensurePricingSchema } from "./pricing-schema";
import {
  getCachedPricing,
  invalidatePricingCache,
  type PricingSnapshot,
  type TermOption,
} from "@/server/payments/pricing-cache";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

export type ResolvedSubjectPrice = {
  subject: Subject;
  amountMinor: number;
  /** Optional struck-through MRP configured by an administrator. */
  listAmountMinor: number | null;
  currency: string;
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
  const res = await pool().query<{
    amount_minor: number;
    list_amount_minor: number | null;
    currency: string;
    razorpay_plan_id: string | null;
  }>(
    `SELECT amount_minor, list_amount_minor, currency, razorpay_plan_id
       FROM pricing.subject_prices WHERE subject = $1`,
    [subject],
  );
  if (res.rows[0]) {
    return {
      subject,
      amountMinor: Number(res.rows[0].amount_minor),
      listAmountMinor: res.rows[0].list_amount_minor == null ? null : Number(res.rows[0].list_amount_minor),
      currency: res.rows[0].currency || "INR",
      razorpayPlanId: res.rows[0].razorpay_plan_id ?? envPlanId(subject),
      overridden: true,
    };
  }
  return {
    subject,
    amountMinor: SUBJECT_PRICE_MINOR,
    listAmountMinor: null,
    currency: "INR",
    razorpayPlanId: envPlanId(subject),
    overridden: false,
  };
}

export type BundleOffer = {
  id: string;
  name: string;
  subjects: string[];
  amountMinor: number;
  listAmountMinor: number | null;
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
    listAmountMinor: row.list_amount_minor == null ? null : Number(row.list_amount_minor),
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

/** Load the uncached student-facing pricing snapshot. */
async function loadPublicPricing(): Promise<PricingSnapshot> {
  const subjects = await Promise.all(
    ALL_SUBJECTS.map(async (s) => {
      const r = await getSubjectPriceResolved(s);
      return {
        subject: s,
        amountMinor: r.amountMinor,
        listAmountMinor: r.listAmountMinor,
      };
    }),
  );
  const bundle = await getActiveBundle();
  const terms = await getTermOptions();
  return {
    subjects,
    bundle: bundle
      ? {
          id: bundle.id,
          name: bundle.name,
          subjects: bundle.subjects,
          amountMinor: bundle.amountMinor,
          listAmountMinor: bundle.listAmountMinor,
        }
      : null,
    terms,
    currency: "INR",
  };
}

/** Student-facing pricing snapshot, cached in Redis with admin-write invalidation. */
export async function getPublicPricing(): Promise<PricingSnapshot> {
  return getCachedPricing(loadPublicPricing);
}

/** Admin-editable term ladder, including inactive options. */
export async function getTermOptions(): Promise<TermOption[]> {
  await ensurePricingSchema();
  const res = await pool().query(
    `SELECT term_months, label, discount_percent
       FROM pricing.term_options
      WHERE active = TRUE
      ORDER BY sort_order ASC, term_months ASC`,
  );
  return res.rows.map((row) => ({
    termMonths: Number(row.term_months),
    label: String(row.label),
    discountPercent: Number(row.discount_percent) || 0,
  }));
}

/** Admin view of all term rows, including inactive rows for reactivation. */
export async function getAdminTermOptions(): Promise<(TermOption & { sortOrder: number; active: boolean })[]> {
  await ensurePricingSchema();
  const res = await pool().query(
    `SELECT term_months, label, discount_percent, sort_order, active
       FROM pricing.term_options
      ORDER BY sort_order ASC, term_months ASC`,
  );
  return res.rows.map((row) => ({
    termMonths: Number(row.term_months),
    label: String(row.label),
    discountPercent: Number(row.discount_percent) || 0,
    sortOrder: Number(row.sort_order) || 0,
    active: Boolean(row.active),
  }));
}

/** Admin view: every subject's effective price + the active bundle. */
export async function getAdminPricing(): Promise<{
  subjects: ResolvedSubjectPrice[];
  bundle: BundleOffer | null;
  terms: (TermOption & { sortOrder: number; active: boolean })[];
}> {
  const subjects = await Promise.all(ALL_SUBJECTS.map((s) => getSubjectPriceResolved(s)));
  const bundle = await getActiveBundle();
  const terms = await getAdminTermOptions();
  return { subjects, bundle, terms };
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

export type RazorpayPlanShape = {
  kind: "subject" | "bundle" | "offering";
  subject?: string | null;
  amountMinor: number;
  currency?: string;
  period?: "monthly";
  name: string;
  notes: Record<string, string>;
};

/**
 * Return a reusable Razorpay plan for an exact billing shape.
 *
 * The advisory lock serialises two cold requests for the same amount, so they
 * cannot both create an undeletable Razorpay plan before the unique DB index
 * arbitrates. The lock lives only for this transaction and is scoped to the
 * shape, leaving unrelated price points fully concurrent.
 */
/**
 * Resolves the Rail-B subscription plan for a price WITHOUT letting a provider
 * problem fail the caller.
 *
 * Admin price edits are Rail-A data. Making them depend on a live Razorpay
 * credential means the pricing console is unusable before keys are configured —
 * which is exactly the state production is in, and the state Phase 10 test-mode
 * validation starts from. Returns null when the plan cannot be resolved; the
 * caller keeps any plan id it already had, and `createSubjectSubscription`
 * resolves one lazily if Rail B is ever turned on.
 */
async function resolveSubscriptionPlanQuietly(shape: RazorpayPlanShape): Promise<string | null> {
  if (!isRazorpayConfigured()) return null;
  try {
    return await getOrCreateMonthlyPlan(shape);
  } catch (error) {
    console.error(
      "[pricing] could not resolve a Razorpay subscription plan; saving the price anyway",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export async function getOrCreateMonthlyPlan(input: RazorpayPlanShape): Promise<string> {
  await ensurePricingSchema();
  const amountMinor = Math.max(0, Math.round(input.amountMinor));
  const currency = input.currency?.trim().toUpperCase() || "INR";
  const period = input.period ?? "monthly";
  const subject = input.subject?.trim().toLowerCase() || null;
  const livemode = isLivemode();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext($1))`,
      [`razorpay-plan:${input.kind}:${subject ?? ""}:${amountMinor}:${currency}:${period}:${livemode}`],
    );
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM pricing.razorpay_plans
        WHERE kind = $1
          AND COALESCE(subject, '') = COALESCE($2, '')
          AND amount_minor = $3
          AND currency = $4
          AND period = $5
          AND livemode = $6
        LIMIT 1`,
      [input.kind, subject, amountMinor, currency, period, livemode],
    );
    if (existing.rows[0]) {
      await client.query("COMMIT");
      return existing.rows[0].id;
    }

    const planId = await createMonthlyPlan(input.name, amountMinor, input.notes);
    await client.query(
      `INSERT INTO pricing.razorpay_plans
         (id, kind, subject, amount_minor, currency, period, livemode)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT DO NOTHING`,
      [planId, input.kind, subject, amountMinor, currency, period, livemode],
    );
    const authoritative = await client.query<{ id: string }>(
      `SELECT id FROM pricing.razorpay_plans
        WHERE kind = $1
          AND COALESCE(subject, '') = COALESCE($2, '')
          AND amount_minor = $3
          AND currency = $4
          AND period = $5
          AND livemode = $6
        LIMIT 1`,
      [input.kind, subject, amountMinor, currency, period, livemode],
    );
    await client.query("COMMIT");
    return authoritative.rows[0]?.id ?? planId;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Admin: set a subject's monthly price. Creates a new Razorpay plan at the new
 * amount (so new subscriptions bill it) and stores both. Throws if Razorpay is
 * not configured — you cannot change the effective price without a plan.
 */
export async function setSubjectPrice(input: {
  subject: Subject;
  amountMinor: number;
  listAmountMinor?: number | null;
  adminUserId: string;
}): Promise<ResolvedSubjectPrice> {
  await ensurePricingSchema();
  // Rail A (prepaid terms) is server-priced and needs no Razorpay object, so a
  // price edit must NOT depend on provider credentials — production currently
  // has none, and an admin changing a price would otherwise get a 500. The
  // subscription plan is resolved best-effort through the SHAPE CACHE, so an
  // edit reuses an existing plan for the same amount instead of minting a new,
  // undeletable one each time.
  const planId = await resolveSubscriptionPlanQuietly({
    kind: "subject",
    subject: input.subject,
    amountMinor: input.amountMinor,
    name: `Origin Premium — ${input.subject} (₹${(input.amountMinor / 100).toFixed(0)}/mo)`,
    notes: { origin_kind: "subject_price", origin_subject: input.subject },
  });
  await pool().query(
    `INSERT INTO pricing.subject_prices
       (subject, amount_minor, list_amount_minor, razorpay_plan_id, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (subject) DO UPDATE SET
       amount_minor = EXCLUDED.amount_minor,
       list_amount_minor = EXCLUDED.list_amount_minor,
       -- A failed/skipped plan resolution must never wipe a plan we already have.
       razorpay_plan_id = COALESCE(EXCLUDED.razorpay_plan_id, pricing.subject_prices.razorpay_plan_id),
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()`,
    [input.subject, input.amountMinor, input.listAmountMinor ?? null, planId, input.adminUserId],
  );
  const result = await getSubjectPriceResolved(input.subject);
  await invalidatePricingCache();
  return result;
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
  listAmountMinor?: number | null;
  active: boolean;
  adminUserId: string;
}): Promise<BundleOffer> {
  await ensurePricingSchema();
  const id = input.id ?? createPrefixedId("bundle");
  const subjects = Array.from(new Set(input.subjects.filter((subject): subject is Subject => isSubject(subject))));
  if (subjects.length === 0) throw new Error("A bundle must contain at least one valid subject");
  const planId = input.active
    ? await resolveSubscriptionPlanQuietly({
        kind: "bundle",
        amountMinor: input.amountMinor,
        name: `Origin Premium — All subjects bundle (₹${(input.amountMinor / 100).toFixed(0)}/mo)`,
        notes: { origin_kind: "bundle_price" },
      })
    : null;

  if (input.active) {
    await pool().query(`UPDATE pricing.bundle_offers SET active = FALSE, updated_at = NOW() WHERE active = TRUE AND id <> $1`, [id]);
  }

  const res = await pool().query(
    `INSERT INTO pricing.bundle_offers
       (id, name, subjects, amount_minor, list_amount_minor, razorpay_plan_id, active, updated_by, updated_at)
     VALUES ($1, $2, $3::text[], $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       subjects = EXCLUDED.subjects,
       amount_minor = EXCLUDED.amount_minor,
       list_amount_minor = EXCLUDED.list_amount_minor,
       razorpay_plan_id = COALESCE(EXCLUDED.razorpay_plan_id, pricing.bundle_offers.razorpay_plan_id),
       active = EXCLUDED.active,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()
     RETURNING *`,
    [
      id,
      input.name,
      subjects,
      input.amountMinor,
      input.listAmountMinor ?? null,
      planId,
      input.active,
      input.adminUserId,
    ],
  );
  const bundle = rowToBundle(res.rows[0]);
  await invalidatePricingCache();
  return bundle;
}

/** Create/update one admin-editable term option. */
export async function upsertTermOption(input: {
  termMonths: number;
  label: string;
  discountPercent: number;
  sortOrder: number;
  active: boolean;
  adminUserId: string;
}): Promise<TermOption & { sortOrder: number; active: boolean }> {
  await ensurePricingSchema();
  const res = await pool().query(
    `INSERT INTO pricing.term_options
       (term_months, label, discount_percent, sort_order, active, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (term_months) DO UPDATE SET
       label = EXCLUDED.label,
       discount_percent = EXCLUDED.discount_percent,
       sort_order = EXCLUDED.sort_order,
       active = EXCLUDED.active,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()
     RETURNING term_months, label, discount_percent, sort_order, active`,
    [
      input.termMonths,
      input.label.trim(),
      input.discountPercent,
      input.sortOrder,
      input.active,
      input.adminUserId,
    ],
  );
  const row = res.rows[0];
  await invalidatePricingCache();
  return {
    termMonths: Number(row.term_months),
    label: String(row.label),
    discountPercent: Number(row.discount_percent) || 0,
    sortOrder: Number(row.sort_order) || 0,
    active: Boolean(row.active),
  };
}

/** Deactivate a term without deleting historical pricing configuration. */
export async function deactivateTermOption(termMonths: number, adminUserId: string): Promise<boolean> {
  await ensurePricingSchema();
  const result = await pool().query(
    `UPDATE pricing.term_options
        SET active = FALSE, updated_by = $2, updated_at = NOW()
      WHERE term_months = $1`,
    [termMonths, adminUserId],
  );
  await invalidatePricingCache();
  return (result.rowCount ?? 0) > 0;
}
