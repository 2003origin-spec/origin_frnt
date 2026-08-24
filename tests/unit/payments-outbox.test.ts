import test from "node:test";
import assert from "node:assert/strict";

import {
  dispatchOutbox,
  dispatchOutboxRow,
  drainOutbox,
  normalizeOutboxPayload,
  paymentNotificationId,
} from "../../src/server/payments/outbox";
import type { OutboxRow } from "../../src/server/payments/payments-store";

function row(overrides: Partial<OutboxRow> = {}): OutboxRow {
  return {
    id: "obx_123",
    kind: "receipt_email",
    payload: {
      user_id: "user_123",
      email: "student@example.test",
      subject: "physics",
      amount_minor: 49900,
      order_id: "ord_123",
    },
    status: "processing",
    attempts: 1,
    error: null,
    dispatchedVia: null,
    createdAt: "2026-08-22T00:00:00.000Z",
    nextAttemptAt: "2026-08-22T00:00:00.000Z",
    doneAt: null,
    ...overrides,
  };
}

test("outbox payload normalization accepts snake_case payment contracts", () => {
  const payload = normalizeOutboxPayload({
    user_id: "user_123",
    recipient: "student@example.test",
    payment_id: "pay_123",
    amount_minor: "49900",
    term_months: 3,
  });
  assert.equal(payload.userId, "user_123");
  assert.equal(payload.to, "student@example.test");
  assert.equal(payload.paymentId, "pay_123");
  assert.equal(payload.amountMinor, 49900);
  assert.equal(payload.termMonths, 3);
});

test("notification ids are stable across retries and support explicit ids", () => {
  assert.equal(paymentNotificationId("obx_123"), "payment:obx_123");
  assert.equal(paymentNotificationId("obx_123", { notification_id: "notif_fixed" }), "notif_fixed");
});

test("receipt dispatch writes notification before email and is injectable", async () => {
  const notifications: Array<{ id: string; userId: string }> = [];
  const emails: string[] = [];
  const result = await dispatchOutboxRow(row(), {
    createNotification: async (id, userId) => {
      notifications.push({ id, userId });
    },
    sendEmail: async (input) => {
      emails.push(input.to);
      return { success: true, messageId: "msg_123" };
    },
  });
  assert.deepEqual(result, {
    email: { sent: true, skipped: false, messageId: "msg_123" },
    notification: { sent: true, skipped: false },
  });
  assert.deepEqual(notifications, [{ id: "payment:obx_123", userId: "user_123" }]);
  assert.deepEqual(emails, ["student@example.test"]);
});

test("dispatch marks done and parks a failed delivery through injected store primitives", async () => {
  const claimed = row();
  const done: string[] = [];
  const failed: Array<{ id: string; error: string; retry: number }> = [];
  const success = await dispatchOutbox("obx_123", "qstash", {
    claimOutboxRow: async () => claimed,
    markOutboxDone: async (id, via) => {
      done.push(`${id}:${via}`);
    },
    markOutboxFailed: async () => {
      throw new Error("must not fail");
    },
    createNotification: async () => undefined,
    sendEmail: async () => ({ success: true, messageId: "msg_123" }),
  });
  assert.equal(success.status, "done");
  assert.deepEqual(done, ["obx_123:qstash"]);

  await assert.rejects(
    () => dispatchOutbox("obx_456", "cron", {
      claimOutboxRow: async () => row({ id: "obx_456" }),
      markOutboxDone: async () => {
        throw new Error("must not mark done");
      },
      markOutboxFailed: async (id, error, retry) => {
        failed.push({ id, error, retry });
      },
      createNotification: async () => undefined,
      sendEmail: async () => ({ success: false, error: new Error("SMTP down") }),
    }),
    /SMTP down/,
  );
  assert.equal(failed.length, 1);
  assert.equal(failed[0].id, "obx_456");
  assert.match(failed[0].error, /SMTP down/);
  assert.equal(failed[0].retry, 60);
});

test("drain processes every claimed row and counts failures without aborting the batch", async () => {
  const done: string[] = [];
  const failed: string[] = [];
  const result = await drainOutbox(10, {
    claimDueOutboxRows: async () => [row({ id: "obx_ok" }), row({ id: "obx_bad" })],
    markOutboxDone: async (id) => {
      done.push(id);
    },
    markOutboxFailed: async (id) => {
      failed.push(id);
    },
    createNotification: async () => undefined,
    sendEmail: async (input) => input.to === "student@example.test" && done.length === 0
      ? { success: true, messageId: "msg_ok" }
      : { success: false, error: new Error("provider down") },
  });
  assert.deepEqual(result, { claimed: 2, done: 1, failed: 1, skipped: 0 });
  assert.deepEqual(done, ["obx_ok"]);
  assert.deepEqual(failed, ["obx_bad"]);
});
