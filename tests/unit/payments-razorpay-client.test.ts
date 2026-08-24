/**
 * Phase 1 — mode-aware Razorpay client.
 *
 * Covers the config resolution that decides whether production takes real money,
 * plus the three signature verifiers. Every case here maps to an edge-case row in
 * V1/RAZORPAY_PAYMENTS_PLAN.md §7 (E24 mode mismatch, E23 bad HMAC, E6 forged
 * client verify).
 */

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import {
  __resetRazorpayClientForTests,
  getRazorpayConfigStatus,
  getRazorpayKeyId,
  getRazorpayMode,
  isLivemode,
  isRazorpayConfigured,
  verifyRazorpayPaymentSignature,
  verifyRazorpaySubscriptionSignature,
  verifyRazorpayWebhookSignature,
} from "../../src/server/payments/razorpay-client";

const KEYS = [
  "RAZORPAY_MODE",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "RAZORPAY_TEST_KEY_ID",
  "RAZORPAY_TEST_KEY_SECRET",
  "RAZORPAY_TEST_WEBHOOK_SECRET",
  "RAZORPAY_LIVE_KEY_ID",
  "RAZORPAY_LIVE_KEY_SECRET",
  "RAZORPAY_LIVE_WEBHOOK_SECRET",
  "RAZORPAY_SUBSCRIPTIONS_ENABLED",
] as const;

/** Runs `fn` with exactly `env` set for the Razorpay vars, restoring after. */
function withEnv(env: Partial<Record<(typeof KEYS)[number], string>>, fn: () => void): void {
  const saved = new Map<string, string | undefined>();
  for (const k of KEYS) {
    saved.set(k, process.env[k]);
    delete process.env[k];
  }
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  __resetRazorpayClientForTests();
  try {
    fn();
  } finally {
    for (const k of KEYS) {
      const v = saved.get(k);
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    __resetRazorpayClientForTests();
  }
}

test("mode defaults to test, and only the exact string 'live' flips it", () => {
  withEnv({}, () => assert.equal(getRazorpayMode(), "test"));
  withEnv({ RAZORPAY_MODE: "live" }, () => assert.equal(getRazorpayMode(), "live"));
  withEnv({ RAZORPAY_MODE: "LIVE" }, () => assert.equal(getRazorpayMode(), "live"));
  withEnv({ RAZORPAY_MODE: " live " }, () => assert.equal(getRazorpayMode(), "live"));
  // Anything unrecognised must fail SAFE to test, never to live.
  withEnv({ RAZORPAY_MODE: "production" }, () => assert.equal(getRazorpayMode(), "test"));
  withEnv({ RAZORPAY_MODE: "" }, () => assert.equal(getRazorpayMode(), "test"));
  withEnv({ RAZORPAY_MODE: "live-ish" }, () => assert.equal(getRazorpayMode(), "test"));
});

test("livemode tracks the mode", () => {
  withEnv({}, () => assert.equal(isLivemode(), false));
  withEnv({ RAZORPAY_MODE: "live" }, () => assert.equal(isLivemode(), true));
});

test("scoped credentials win over the legacy flat names", () => {
  withEnv(
    {
      RAZORPAY_MODE: "test",
      RAZORPAY_KEY_ID: "rzp_test_legacy",
      RAZORPAY_TEST_KEY_ID: "rzp_test_scoped",
      RAZORPAY_KEY_SECRET: "s",
    },
    () => {
      assert.equal(getRazorpayKeyId(), "rzp_test_scoped");
      assert.equal(getRazorpayConfigStatus().source.KEY_ID, "scoped");
    },
  );
});

test("legacy flat names still work when no scoped pair is set (back-compat)", () => {
  withEnv({ RAZORPAY_KEY_ID: "rzp_test_legacy", RAZORPAY_KEY_SECRET: "s" }, () => {
    assert.equal(getRazorpayKeyId(), "rzp_test_legacy");
    assert.equal(isRazorpayConfigured(), true);
    assert.equal(getRazorpayConfigStatus().source.KEY_ID, "legacy");
  });
});

test("switching mode switches which credential set is read", () => {
  const env = {
    RAZORPAY_TEST_KEY_ID: "rzp_test_aaa",
    RAZORPAY_TEST_KEY_SECRET: "ts",
    RAZORPAY_LIVE_KEY_ID: "rzp_live_bbb",
    RAZORPAY_LIVE_KEY_SECRET: "ls",
  };
  withEnv({ ...env, RAZORPAY_MODE: "test" }, () => assert.equal(getRazorpayKeyId(), "rzp_test_aaa"));
  withEnv({ ...env, RAZORPAY_MODE: "live" }, () => assert.equal(getRazorpayKeyId(), "rzp_live_bbb"));
});

test("E24: a live-mode deploy carrying a TEST key is rejected, not silently used", () => {
  withEnv({ RAZORPAY_MODE: "live", RAZORPAY_KEY_ID: "rzp_test_oops", RAZORPAY_KEY_SECRET: "s" }, () => {
    assert.throws(() => getRazorpayKeyId(), /RAZORPAY_MODE=live but the resolved key id is a TEST key/);
    const status = getRazorpayConfigStatus();
    assert.ok(status.modeMismatch, "health must surface the mismatch");
    assert.match(status.modeMismatch!, /TEST key/);
  });
});

test("E24: a test-mode deploy carrying a LIVE key is rejected", () => {
  withEnv({ RAZORPAY_MODE: "test", RAZORPAY_KEY_ID: "rzp_live_oops", RAZORPAY_KEY_SECRET: "s" }, () => {
    assert.throws(() => getRazorpayKeyId(), /resolved key id is a LIVE key/);
  });
});

test("an unrecognised key-id shape is not guessed at", () => {
  withEnv({ RAZORPAY_MODE: "live", RAZORPAY_KEY_ID: "stub_key", RAZORPAY_KEY_SECRET: "s" }, () => {
    assert.equal(getRazorpayKeyId(), "stub_key");
    assert.equal(getRazorpayConfigStatus().modeMismatch, null);
  });
});

test("missing credentials throw a message naming BOTH env spellings", () => {
  withEnv({ RAZORPAY_MODE: "live" }, () => {
    assert.throws(() => getRazorpayKeyId(), /RAZORPAY_LIVE_KEY_ID \(or the legacy RAZORPAY_KEY_ID\)/);
    assert.equal(isRazorpayConfigured(), false);
  });
});

test("config status reports presence only — never a secret value", () => {
  withEnv(
    {
      RAZORPAY_MODE: "test",
      RAZORPAY_TEST_KEY_ID: "rzp_test_k",
      RAZORPAY_TEST_KEY_SECRET: "super_secret_value",
      RAZORPAY_TEST_WEBHOOK_SECRET: "whsec_super_secret",
      RAZORPAY_SUBSCRIPTIONS_ENABLED: "1",
    },
    () => {
      const status = getRazorpayConfigStatus();
      assert.deepEqual(
        { ...status, source: undefined },
        {
          mode: "test",
          livemode: false,
          keyIdConfigured: true,
          keySecretConfigured: true,
          webhookSecretConfigured: true,
          modeMismatch: null,
          subscriptionsEnabled: true,
          source: undefined,
        },
      );
      const serialized = JSON.stringify(status);
      assert.ok(!serialized.includes("super_secret_value"), "key secret must not leak");
      assert.ok(!serialized.includes("whsec_super_secret"), "webhook secret must not leak");
    },
  );
});

test("subscriptionsEnabled is off unless it is exactly '1'", () => {
  for (const v of ["0", "true", "yes", ""]) {
    withEnv({ RAZORPAY_SUBSCRIPTIONS_ENABLED: v }, () =>
      assert.equal(getRazorpayConfigStatus().subscriptionsEnabled, false, `value ${JSON.stringify(v)}`),
    );
  }
  withEnv({ RAZORPAY_SUBSCRIPTIONS_ENABLED: "1" }, () =>
    assert.equal(getRazorpayConfigStatus().subscriptionsEnabled, true),
  );
});

test("E23: webhook HMAC accepts a valid signature and rejects every tampering", () => {
  withEnv({ RAZORPAY_TEST_WEBHOOK_SECRET: "whsec_x" }, () => {
    const body = JSON.stringify({ event: "order.paid", payload: {} });
    const good = crypto.createHmac("sha256", "whsec_x").update(body, "utf8").digest("hex");
    assert.equal(verifyRazorpayWebhookSignature(body, good), true);
    assert.equal(verifyRazorpayWebhookSignature(body, good.replace(/.$/, "0")), false);
    assert.equal(verifyRazorpayWebhookSignature(`${body} `, good), false);
    assert.equal(verifyRazorpayWebhookSignature(body, null), false);
    assert.equal(verifyRazorpayWebhookSignature(body, ""), false);
    assert.equal(verifyRazorpayWebhookSignature(body, good.slice(0, -1)), false, "length mismatch");
  });
});

test("webhook verification fails closed when no secret is configured", () => {
  withEnv({}, () => {
    const body = "{}";
    const anySig = crypto.createHmac("sha256", "whatever").update(body).digest("hex");
    assert.equal(verifyRazorpayWebhookSignature(body, anySig), false);
  });
});

test("the webhook secret follows the mode, so a test secret cannot verify live traffic", () => {
  const env = { RAZORPAY_TEST_WEBHOOK_SECRET: "test_whsec", RAZORPAY_LIVE_WEBHOOK_SECRET: "live_whsec" };
  const body = JSON.stringify({ event: "payment.captured" });
  const signedWithTest = crypto.createHmac("sha256", "test_whsec").update(body).digest("hex");
  withEnv({ ...env, RAZORPAY_MODE: "test" }, () =>
    assert.equal(verifyRazorpayWebhookSignature(body, signedWithTest), true),
  );
  withEnv({ ...env, RAZORPAY_MODE: "live" }, () =>
    assert.equal(verifyRazorpayWebhookSignature(body, signedWithTest), false),
  );
});

test("E6: client-side order signature verifies over order_id|payment_id", () => {
  withEnv({ RAZORPAY_TEST_KEY_SECRET: "ksec" }, () => {
    const sig = crypto.createHmac("sha256", "ksec").update("order_9|pay_9").digest("hex");
    assert.equal(
      verifyRazorpayPaymentSignature({ razorpayOrderId: "order_9", razorpayPaymentId: "pay_9", signature: sig }),
      true,
    );
    // A forged signature, a swapped operand order, and missing ids all fail.
    assert.equal(
      verifyRazorpayPaymentSignature({ razorpayOrderId: "order_9", razorpayPaymentId: "pay_X", signature: sig }),
      false,
    );
    const swapped = crypto.createHmac("sha256", "ksec").update("pay_9|order_9").digest("hex");
    assert.equal(
      verifyRazorpayPaymentSignature({ razorpayOrderId: "order_9", razorpayPaymentId: "pay_9", signature: swapped }),
      false,
    );
    assert.equal(
      verifyRazorpayPaymentSignature({ razorpayOrderId: "", razorpayPaymentId: "pay_9", signature: sig }),
      false,
    );
    assert.equal(
      verifyRazorpayPaymentSignature({ razorpayOrderId: "order_9", razorpayPaymentId: "pay_9", signature: null }),
      false,
    );
  });
});

test("subscription signature uses Razorpay's REVERSED operand order", () => {
  withEnv({ RAZORPAY_TEST_KEY_SECRET: "ksec" }, () => {
    const sig = crypto.createHmac("sha256", "ksec").update("pay_1|sub_1").digest("hex");
    assert.equal(
      verifyRazorpaySubscriptionSignature({ razorpaySubscriptionId: "sub_1", razorpayPaymentId: "pay_1", signature: sig }),
      true,
    );
    const orderStyle = crypto.createHmac("sha256", "ksec").update("sub_1|pay_1").digest("hex");
    assert.equal(
      verifyRazorpaySubscriptionSignature({ razorpaySubscriptionId: "sub_1", razorpayPaymentId: "pay_1", signature: orderStyle }),
      false,
    );
  });
});
