/**
 * Cached student-facing pricing snapshot (payments plan D10).
 *
 * The admin console is the source of truth for prices, the MRP shown struck
 * through, the bundle and the term ladder. Every student page load needs all of
 * it, and resolving it from scratch is ~6 queries. This caches the resolved
 * snapshot in Redis for a short TTL and — the part that actually matters —
 * DELETES the key on every admin write, so a price change is visible on the
 * next student page load rather than up to a TTL later.
 *
 * Safety note: this cache is for DISPLAY. The authoritative amount is re-resolved
 * server-side at order creation (`resolveOrderAmount`, Phase 3), so even a stale
 * snapshot can never cause a student to be charged the wrong price — it can only
 * briefly show one.
 *
 * The loader is injectable so the caching behaviour is testable without pulling
 * in pricing-service (which is `server-only` and cannot load under node:test).
 */

import { cacheDelete, cacheGetJson, cacheSetJson } from "./payments-redis";

/** Bump when the shape below changes, so old cached blobs are ignored. */
export const PRICING_CACHE_KEY = "pricing:v1";

/** Short by design — the invalidation hook is the real freshness mechanism;
 *  the TTL is only a backstop for a missed DELETE. */
export const PRICING_CACHE_TTL_SECONDS = 300;

export type TermOption = {
  termMonths: number;
  label: string;
  discountPercent: number;
};

export type SubjectPricing = {
  subject: string;
  amountMinor: number;
  /** MRP for the struck-through price. Null when no discount is being shown. */
  listAmountMinor: number | null;
};

export type PricingSnapshot = {
  subjects: SubjectPricing[];
  bundle: {
    id: string;
    name: string;
    subjects: string[];
    amountMinor: number;
    listAmountMinor: number | null;
  } | null;
  terms: TermOption[];
  currency: string;
};

export type PricingLoader = () => Promise<PricingSnapshot>;

/**
 * Returns the snapshot, from cache when warm. A Redis outage degrades to
 * "always load" — correct, just slower.
 */
export async function getCachedPricing(loader: PricingLoader): Promise<PricingSnapshot> {
  const cached = await cacheGetJson<PricingSnapshot>(PRICING_CACHE_KEY);
  if (cached && isSnapshot(cached)) return cached;
  const fresh = await loader();
  await cacheSetJson(PRICING_CACHE_KEY, fresh, PRICING_CACHE_TTL_SECONDS);
  return fresh;
}

/**
 * Drops the cached snapshot. Call from EVERY admin mutation that can change a
 * displayed price: subject price, MRP, bundle, term ladder, coupon activation.
 * Never throws — a failed invalidation degrades to the TTL, and an admin write
 * must not fail because a cache delete did.
 */
export async function invalidatePricingCache(): Promise<void> {
  await cacheDelete(PRICING_CACHE_KEY);
}

/**
 * Guards against a cached blob written by an older deploy with a different
 * shape. Cheaper and safer than trusting whatever is in Redis: a snapshot
 * missing `terms` would otherwise render a page with no buy buttons.
 */
function isSnapshot(value: unknown): value is PricingSnapshot {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<PricingSnapshot>;
  return Array.isArray(v.subjects) && Array.isArray(v.terms) && typeof v.currency === "string";
}

/**
 * Applies a term's discount to a base monthly amount.
 *
 * Rounded to whole rupees (100 paise) so no price ever renders with paise —
 * `₹1,349` rather than `₹1,347.30`. Rounding happens ONCE, on the final total.
 */
export function amountForTerm(monthlyMinor: number, term: TermOption): number {
  const gross = monthlyMinor * term.termMonths;
  const net = gross - Math.round((gross * term.discountPercent) / 100);
  return Math.max(0, Math.round(net / 100) * 100);
}
