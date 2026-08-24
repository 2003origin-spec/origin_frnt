import test from "node:test";
import assert from "node:assert/strict";

import {
  formatPaymentAmount,
  renderDunningEmail,
  renderPaymentFailedEmail,
  renderReceiptEmail,
  renderRefundEmail,
  sendPaymentReceipt,
} from "../../src/server/payments/emails";

test("payment email renderers format minor units and escape untrusted values", () => {
  assert.equal(formatPaymentAmount(49900), "₹499");
  const receipt = renderReceiptEmail({
    to: "student@example.test",
    studentName: "<img src=x onerror=alert(1)>",
    subject: "<physics>",
    amountMinor: 49900,
    orderId: "ord_123",
    paymentId: "pay_123",
    termMonths: 1,
  });
  assert.equal(receipt.to, "student@example.test");
  assert.match(receipt.text, /INR|₹/);
  assert.match(receipt.html ?? "", /&lt;img/);
  assert.doesNotMatch(receipt.html ?? "", /<img src=x/);
});

test("payment failure, refund, and dunning templates carry their policy copy", () => {
  const failed = renderPaymentFailedEmail({
    to: "student@example.test",
    subject: "physics",
    failureReason: "insufficient funds",
    retryHref: "/premium",
  });
  assert.match(failed.subject, /could not be completed/i);
  assert.match(failed.text, /insufficient funds/);
  assert.match(failed.html ?? "", /Try again/);

  const refund = renderRefundEmail({
    to: "student@example.test",
    subject: "physics",
    refundAmountMinor: 24950,
    isFull: false,
  });
  assert.match(refund.subject, /partially refunded/i);
  assert.match(refund.text, /remains active/i);

  const dunning = renderDunningEmail({
    to: "student@example.test",
    subject: "physics",
    daysUntilExpiry: 7,
  });
  assert.match(dunning.text, /7 days/);
  assert.match(dunning.html ?? "", /Choose a term/);
});

test("payment email delivery skips a missing recipient and surfaces provider failure", async () => {
  let calls = 0;
  const skipped = await sendPaymentReceipt({ amountMinor: 100 }, async () => {
    calls += 1;
    return { success: true, messageId: "unexpected" };
  });
  assert.deepEqual(skipped, { sent: false, skipped: true });
  assert.equal(calls, 0);

  await assert.rejects(
    () => sendPaymentReceipt({ to: "student@example.test", amountMinor: 100 }, async () => ({
      success: false,
      error: new Error("SES unavailable"),
    })),
    /SES unavailable/,
  );
});
