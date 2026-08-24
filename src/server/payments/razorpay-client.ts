/**
 * Shared Razorpay server client + signature verification.
 *
 * MODE-AWARE (payments plan D9). Razorpay test mode and live mode are separate
 * accounts with separate credentials, and a credential is not one value — it is
 * a publishable `key_id`, a server-only `key_secret`, and a *separate* webhook
 * signing secret generated when the webhook URL is registered. All three must
 * belong to the same mode or every HMAC silently fails.
 *
 * Resolution order for each of the three values:
 *   1. RAZORPAY_{TEST,LIVE}_*  — chosen by RAZORPAY_MODE (default "test")
 *   2. RAZORPAY_*              — the legacy flat names, kept so the existing
 *                                subscriptions/connect code and any already-set
 *                                environment keep working untouched.
 *
 * Going live is therefore a single edit: RAZORPAY_MODE=test → live.
 *
 * The client is server-only; the browser uses checkout.razorpay.com/v1/checkout.js
 * with the publishable key id.
 *
 * See V1/RAZORPAY_PAYMENTS_PLAN.md (D9, Phase 1).
 */

import crypto from "node:crypto";

import Razorpay from "razorpay";

export type RazorpayMode = "test" | "live";

type CredentialName = "KEY_ID" | "KEY_SECRET" | "WEBHOOK_SECRET";

let cachedClient: Razorpay | null = null;
let cachedCacheKey: string | null = null;

/** The active mode. Anything other than "live" is treated as test — fail safe. */
export function getRazorpayMode(): RazorpayMode {
  return process.env.RAZORPAY_MODE?.trim().toLowerCase() === "live" ? "live" : "test";
}

/** True when the active mode moves real money. Stamped onto every ledger row. */
export function isLivemode(): boolean {
  return getRazorpayMode() === "live";
}

/**
 * Reads one credential for the active mode, falling back to the legacy flat name.
 * Returns null rather than throwing so the health endpoint can report on config
 * without blowing up.
 */
function readCredential(name: CredentialName): string | null {
  const mode = getRazorpayMode().toUpperCase();
  const scoped = process.env[`RAZORPAY_${mode}_${name}`]?.trim();
  if (scoped) return scoped;
  const legacy = process.env[`RAZORPAY_${name}`]?.trim();
  return legacy || null;
}

function requireCredential(name: CredentialName): string {
  const value = readCredential(name);
  if (!value) {
    const mode = getRazorpayMode().toUpperCase();
    throw new Error(
      `RAZORPAY_${mode}_${name} (or the legacy RAZORPAY_${name}) must be configured ` +
        `before Razorpay can be used in ${getRazorpayMode()} mode.`,
    );
  }
  return value;
}

/**
 * Guards the single most damaging misconfiguration: a live-mode deploy still
 * carrying test credentials (or the reverse). Razorpay key ids are prefixed
 * `rzp_test_` / `rzp_live_`, so the mismatch is detectable before the first
 * charge rather than after a day of silently failing webhooks.
 */
function assertKeyMatchesMode(keyId: string): void {
  const mode = getRazorpayMode();
  const looksLive = keyId.startsWith("rzp_live_");
  const looksTest = keyId.startsWith("rzp_test_");
  if (!looksLive && !looksTest) return; // unknown shape (or a stub in tests) — don't guess
  if (mode === "live" && !looksLive) {
    throw new Error(
      "RAZORPAY_MODE=live but the resolved key id is a TEST key. Set RAZORPAY_LIVE_KEY_ID / " +
        "RAZORPAY_LIVE_KEY_SECRET / RAZORPAY_LIVE_WEBHOOK_SECRET, or switch RAZORPAY_MODE back to test.",
    );
  }
  if (mode === "test" && !looksTest) {
    throw new Error(
      "RAZORPAY_MODE=test but the resolved key id is a LIVE key. Refusing to run live credentials " +
        "in test mode — set RAZORPAY_TEST_* or switch RAZORPAY_MODE to live.",
    );
  }
}

/** Memoised Razorpay client for the active mode. Throws if it is not configured. */
export function getRazorpayClient(): Razorpay {
  const keyId = requireCredential("KEY_ID");
  const keySecret = requireCredential("KEY_SECRET");
  assertKeyMatchesMode(keyId);
  // Re-key the cache on mode too, so flipping RAZORPAY_MODE in a long-lived
  // process (tests, a warm lambda after an env change) cannot serve a stale client.
  const cacheKey = `${getRazorpayMode()}:${keyId}`;
  if (cachedClient && cachedCacheKey === cacheKey) return cachedClient;
  cachedClient = new Razorpay({ key_id: keyId, key_secret: keySecret });
  cachedCacheKey = cacheKey;
  return cachedClient;
}

/** The publishable key id forwarded to the browser checkout. */
export function getRazorpayKeyId(): string {
  const keyId = requireCredential("KEY_ID");
  assertKeyMatchesMode(keyId);
  return keyId;
}

/** True when a client could be constructed right now. Never throws. */
export function isRazorpayConfigured(): boolean {
  return Boolean(readCredential("KEY_ID") && readCredential("KEY_SECRET"));
}

/**
 * Verifies a Razorpay webhook HMAC. Razorpay signs the raw request body with the
 * webhook secret (HMAC-SHA256) and sends the hex digest in `x-razorpay-signature`.
 * Constant-time comparison.
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string | null | undefined,
): boolean {
  if (!signature) return false;
  const secret = readCredential("WEBHOOK_SECRET");
  if (!secret) return false;
  return timingSafeHexEquals(
    crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex"),
    signature,
  );
}

/**
 * Verifies the signature the browser checkout hands back on success:
 * `HMAC_SHA256(order_id + "|" + payment_id, key_secret)`.
 *
 * This is the FAST PATH only (plan D6) — it lets the page unlock immediately
 * instead of waiting on the webhook. The webhook remains the source of truth,
 * and both converge on the same idempotent apply, so a client that never calls
 * this loses nothing but latency.
 */
export function verifyRazorpayPaymentSignature(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string | null | undefined;
}): boolean {
  if (!input.signature || !input.razorpayOrderId || !input.razorpayPaymentId) return false;
  const secret = readCredential("KEY_SECRET");
  if (!secret) return false;
  return timingSafeHexEquals(
    crypto
      .createHmac("sha256", secret)
      .update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`, "utf8")
      .digest("hex"),
    input.signature,
  );
}

/**
 * Verifies a Razorpay *subscription* checkout signature:
 * `HMAC_SHA256(payment_id + "|" + subscription_id, key_secret)`.
 * Note the operand order is the reverse of the order flow above — that is
 * Razorpay's contract, not a typo.
 */
export function verifyRazorpaySubscriptionSignature(input: {
  razorpaySubscriptionId: string;
  razorpayPaymentId: string;
  signature: string | null | undefined;
}): boolean {
  if (!input.signature || !input.razorpaySubscriptionId || !input.razorpayPaymentId) return false;
  const secret = readCredential("KEY_SECRET");
  if (!secret) return false;
  return timingSafeHexEquals(
    crypto
      .createHmac("sha256", secret)
      .update(`${input.razorpayPaymentId}|${input.razorpaySubscriptionId}`, "utf8")
      .digest("hex"),
    input.signature,
  );
}

function timingSafeHexEquals(expected: string, provided: string): boolean {
  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(provided, "utf8");
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

export type RazorpayConfigStatus = {
  mode: RazorpayMode;
  livemode: boolean;
  keyIdConfigured: boolean;
  keySecretConfigured: boolean;
  webhookSecretConfigured: boolean;
  /** Non-null when the resolved key id contradicts RAZORPAY_MODE. */
  modeMismatch: string | null;
  /** Which env names actually supplied each value — "scoped" | "legacy" | null. */
  source: Record<CredentialName, "scoped" | "legacy" | null>;
  subscriptionsEnabled: boolean;
};

/**
 * Config snapshot for /api/internal/payments/health. Deliberately reports only
 * presence and provenance — never a secret, never a partial secret.
 */
export function getRazorpayConfigStatus(): RazorpayConfigStatus {
  const mode = getRazorpayMode();
  const scopedPrefix = `RAZORPAY_${mode.toUpperCase()}_`;
  const sourceOf = (name: CredentialName): "scoped" | "legacy" | null => {
    if (process.env[`${scopedPrefix}${name}`]?.trim()) return "scoped";
    if (process.env[`RAZORPAY_${name}`]?.trim()) return "legacy";
    return null;
  };

  const keyId = readCredential("KEY_ID");
  let modeMismatch: string | null = null;
  if (keyId) {
    try {
      assertKeyMatchesMode(keyId);
    } catch (error) {
      modeMismatch = error instanceof Error ? error.message : String(error);
    }
  }

  return {
    mode,
    livemode: mode === "live",
    keyIdConfigured: Boolean(keyId),
    keySecretConfigured: Boolean(readCredential("KEY_SECRET")),
    webhookSecretConfigured: Boolean(readCredential("WEBHOOK_SECRET")),
    modeMismatch,
    source: {
      KEY_ID: sourceOf("KEY_ID"),
      KEY_SECRET: sourceOf("KEY_SECRET"),
      WEBHOOK_SECRET: sourceOf("WEBHOOK_SECRET"),
    },
    subscriptionsEnabled: process.env.RAZORPAY_SUBSCRIPTIONS_ENABLED?.trim() === "1",
  };
}

/**
 * Rail B (recurring mandates) is dark until Razorpay approves e-mandate/UPI
 * Autopay on the account — plan D1/Q2. One env var turns it on; there is no
 * code path or migration behind the switch.
 */
export function isSubscriptionsRailEnabled(): boolean {
  return process.env.RAZORPAY_SUBSCRIPTIONS_ENABLED?.trim() === "1";
}

/** Test-only: drop the memoised client so a re-keyed env is picked up. */
export function __resetRazorpayClientForTests(): void {
  cachedClient = null;
  cachedCacheKey = null;
}
