/**
 * Store items with a rupee price (decision B92) through the real Razorpay
 * one-time-order rail with a stubbed gateway: only when switched on; the
 * coins are taken and the stock reserved at checkout; the server prices the
 * rupees; capture hands the item over exactly once (premium granted, merch
 * into the packing queue); an unpaid checkout gives coins and stock back;
 * a payment that arrives after that is logged for an admin.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { getWalletBalance } from "@/server/now/ledger-store";
import { releaseUnpaidStoreOrders, startStoreCheckout } from "@/server/now/store-checkout";
import { buyStoreItem, upsertStoreItem } from "@/server/now/store-service";
import { ensureWelcomeGrant } from "@/server/now/wallet-service";
import { applyPaymentSuccess, type RazorpayOrder, type RazorpayOrdersClient } from "@/server/payments/orders-service";
import { ensurePaymentsAndGrantSchema } from "@/server/payments/payments-schema";

import { closePool, makeId, rawPool } from "./_db";
import { NOW_SKIP, WELCOME, assertLedgerBalanced, cleanupNowFixtures, seedStudent, setFeatures, setup } from "./_now";

test.after(async () => {
  if (!NOW_SKIP) await setup();
  await cleanupNowFixtures();
  await closePool();
});

const gateway = {
  keyId: "rzp_test_store",
  razorpayClient: {
    orders: {
      async create(input): Promise<RazorpayOrder> {
        return { id: makeId("order_rzp"), amount: input.amount, currency: input.currency, status: "created" };
      },
    },
  } satisfies RazorpayOrdersClient,
};
const code = (c: string) => (e: { code?: string }) => e.code === c;
const ADDRESS = { name: "Meera Iyer", phone: "9876543210", line1: "12, 3rd Cross, Indiranagar", city: "Bengaluru", state: "Karnataka", pincode: "560038" };

async function buyer() {
  const id = await seedStudent();
  await ensureWelcomeGrant(id);
  return id;
}

function pay(checkout: { orderId: string; razorpayOrderId: string | null; amountMinor: number }, paymentId = makeId("pay")) {
  return applyPaymentSuccess({
    orderId: checkout.orderId,
    razorpayOrderId: checkout.razorpayOrderId,
    razorpayPaymentId: paymentId,
    amountMinor: checkout.amountMinor,
    currency: "INR",
    method: "upi",
    raw: { test: true },
  });
}

test("premium for coins + rupees: priced by the server, granted once on capture", { skip: NOW_SKIP }, async () => {
  await setup();
  await ensurePaymentsAndGrantSchema();
  await setFeatures({ rupeePrices: true });
  const item = await upsertStoreItem({
    kind: "premium",
    title: "Physics premium, 30 days",
    priceCoins: 50,
    pricePaise: 19_900,
    premiumSubject: "physics",
    premiumDays: 30,
    active: true,
  });
  const student = await buyer();
  await assert.rejects(buyStoreItem(student, item.id, makeId("k")), code("pay_online"), "Buy is for coins-only items");

  const key = makeId("k");
  const checkout = await startStoreCheckout(student, item.id, key, {}, new Date(), gateway);
  assert.equal(checkout.state, "pay");
  if (checkout.state !== "pay") return;
  assert.equal(checkout.amountMinor, 19_900, "the rupee price comes from the item, frozen on the store order");
  assert.equal((await getWalletBalance(student)).available, WELCOME - 50, "coins taken at checkout");
  const again = await startStoreCheckout(student, item.id, key, {}, new Date(), gateway);
  assert.equal(again.state === "pay" && again.orderId, checkout.orderId, "the same key resumes the same payment");

  await pay(checkout);
  const order = (await rawPool().query(`SELECT status, paise_paid, grant_id, payment_order_id FROM store.orders WHERE id = $1`, [checkout.storeOrderId])).rows[0];
  assert.equal(order.status, "fulfilled");
  assert.equal(order.paise_paid, 19_900);
  assert.equal(order.payment_order_id, checkout.orderId);
  assert.ok(order.grant_id, "coin premium granted");
  const grants = await rawPool().query(`SELECT count(*)::int AS n FROM entitlements.subject_grants WHERE id = $1 AND status = 'active'`, [order.grant_id]);
  assert.equal(grants.rows[0].n, 1);
  // A second capture event (webhook after verify) changes nothing.
  await pay(checkout, makeId("pay_dup")).catch(() => undefined);
  const count = await rawPool().query(`SELECT count(*)::int AS n FROM entitlements.subject_grants WHERE user_id = $1`, [student]);
  assert.equal(count.rows[0].n, 1);
  await assertLedgerBalanced();
});

test("merch for rupees: into the packing queue only once paid; an unpaid checkout gives coins and stock back", { skip: NOW_SKIP }, async () => {
  await setup();
  await ensurePaymentsAndGrantSchema();
  await setFeatures({ rupeePrices: true, merch: true });
  const tee = await upsertStoreItem({ kind: "merch", title: "Origin hoodie", priceCoins: 20, pricePaise: 79_900, active: true, sizeStock: { M: 1 } });

  // Unpaid: the order waits (not in the packing queue), the size is reserved, then released.
  const a = await buyer();
  const unpaid = await startStoreCheckout(a, tee.id, makeId("k"), { size: "M", delivery: ADDRESS }, new Date(), gateway);
  assert.equal(unpaid.state, "pay");
  if (unpaid.state !== "pay") return;
  const waiting = (await rawPool().query(`SELECT status, ship_status FROM store.orders WHERE id = $1`, [unpaid.storeOrderId])).rows[0];
  assert.deepEqual(waiting, { status: "placed", ship_status: null }, "not packed before it is paid");
  const b = await buyer();
  await assert.rejects(startStoreCheckout(b, tee.id, makeId("k"), { size: "M", delivery: ADDRESS }, new Date(), gateway), code("sold_out"));
  assert.ok((await releaseUnpaidStoreOrders(new Date(Date.now() + 46 * 60_000))) >= 1);
  assert.equal((await getWalletBalance(a)).available, WELCOME, "coins back");
  assert.equal((await rawPool().query(`SELECT size_stock FROM store.items WHERE id = $1`, [tee.id])).rows[0].size_stock.M, 1, "size back");

  // Paid after it was released: logged for an admin, the order stays cancelled.
  await pay(unpaid);
  assert.equal((await rawPool().query(`SELECT status FROM store.orders WHERE id = $1`, [unpaid.storeOrderId])).rows[0].status, "cancelled");
  const late = await rawPool().query(`SELECT count(*)::int AS n FROM now.events WHERE type = 'store.paid_after_release' AND payload->>'storeOrderId' = $1`, [unpaid.storeOrderId]);
  assert.equal(late.rows[0].n, 1);

  // Paid in time: into the packing queue.
  const paid = await startStoreCheckout(b, tee.id, makeId("k"), { size: "M", delivery: ADDRESS }, new Date(), gateway);
  if (paid.state !== "pay") throw new Error("expected a payment");
  await pay(paid);
  const done = (await rawPool().query(`SELECT status, ship_status, paise_paid FROM store.orders WHERE id = $1`, [paid.storeOrderId])).rows[0];
  assert.deepEqual(done, { status: "paid", ship_status: "to_pack", paise_paid: 79_900 });
  await assertLedgerBalanced();

  await setFeatures({ merch: true });
  await assert.rejects(startStoreCheckout(a, tee.id, makeId("k"), { size: "M", delivery: ADDRESS }, new Date(), gateway), code("not_on_sale"), "off again");
});
