/**
 * Merch with delivery (decision B91) against a real Postgres: only when
 * switched on; size stock; the delivery address checked, kept for packing
 * and shown back only as the place; the buyer cancels before packing and
 * gets the coins back; admins pack, ship and deliver; addresses are wiped
 * after 90 days.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { getWalletBalance } from "@/server/now/ledger-store";
import {
  cancelMyMerchOrder,
  confirmMerchImage,
  createMerchImageUpload,
  getLastDeliveryAddress,
  listMerchOrdersForAdmin,
  purgeOldDeliveryAddresses,
  updateMerchShipment,
} from "@/server/now/merch-service";
import { buyStoreItem, listMyOrders, listStoreItems, upsertStoreItem } from "@/server/now/store-service";
import { ensureWelcomeGrant } from "@/server/now/wallet-service";

import { closePool, rawPool } from "./_db";
import { NOW_SKIP, WELCOME, assertLedgerBalanced, cleanupNowFixtures, seedStudent, setFeatures, setup } from "./_now";

const savedEnv = { ...process.env };
test.before(() => {
  process.env.R2_ENDPOINT = "https://acct.r2.cloudflarestorage.invalid";
  process.env.R2_ACCESS_KEY_ID = "app-key";
  process.env.R2_SECRET_ACCESS_KEY = "app-secret";
  process.env.R2_PUBLIC_BASE_URL = "https://media.example.invalid";
});
test.after(async () => {
  process.env = savedEnv;
  if (!NOW_SKIP) await setup();
  await cleanupNowFixtures();
  await closePool();
});

const code = (c: string) => (e: { code?: string }) => e.code === c;
const ADDRESS = { name: "Meera Iyer", phone: "98765 43210", line1: "12, 3rd Cross, Indiranagar", city: "Bengaluru", state: "Karnataka", pincode: "560038" };
let n = 0;
const key = () => `merch-${Date.now()}-${(n += 1)}`;

async function buyer() {
  const id = await seedStudent();
  await ensureWelcomeGrant(id);
  return id;
}

test("merch: sizes, address, cancel with coins back, pack / ship / deliver, address wiped later", { skip: NOW_SKIP }, async () => {
  await setup();
  await assert.rejects(upsertStoreItem({ kind: "merch", title: "Origin tee", priceCoins: 50 }), code("invalid_item"), "off by default");
  await setFeatures({ merch: true });
  const tee = await upsertStoreItem({ kind: "merch", title: "Origin tee", priceCoins: 50, active: true, sizeStock: { S: 1, M: 2 } });

  const upload = await createMerchImageUpload(tee.id, { mimeType: "image/png", sizeBytes: 2048 });
  assert.match(upload.objectKey, new RegExp(`^origin-now/store-images/${tee.id}/`));
  assert.match((await confirmMerchImage(tee.id, upload.objectKey)).imageUrl ?? "", /^https:\/\/media\.example\.invalid\/origin-now\/store-images\//);

  const a = await buyer();
  const listed = (await listStoreItems(a)).items.find((i) => i.id === tee.id)!;
  assert.deepEqual(listed.sizes, [{ size: "S", inStock: true }, { size: "M", inStock: true }]);
  assert.ok(listed.imageUrl);

  await assert.rejects(buyStoreItem(a, tee.id, key(), new Date(), { size: "S" }), code("invalid_address"));
  await assert.rejects(buyStoreItem(a, tee.id, key(), new Date(), { size: "XL", delivery: ADDRESS }), code("pick_size"));
  const first = await buyStoreItem(a, tee.id, key(), new Date(), { size: "S", delivery: ADDRESS });
  assert.equal(first.order.shipStatus, "to_pack");
  assert.equal(first.order.deliverTo, "Bengaluru, Karnataka 560038", "the buyer's list shows the place, not the street");
  assert.equal(first.order.canCancel, true);
  assert.equal((await getWalletBalance(a)).available, WELCOME - 50);

  const b = await buyer();
  await assert.rejects(buyStoreItem(b, tee.id, key(), new Date(), { size: "S", delivery: ADDRESS }), code("sold_out"));

  // The buyer cancels before packing: coins and stock come back.
  const cancelled = await cancelMyMerchOrder(a, first.order.id);
  assert.equal(cancelled.shipStatus, "cancelled");
  assert.equal((await getWalletBalance(a)).available, WELCOME);
  await assert.rejects(cancelMyMerchOrder(a, first.order.id), code("too_late"));
  await assert.rejects(cancelMyMerchOrder(b, first.order.id), code("not_found"), "only the buyer");
  const again = await buyStoreItem(b, tee.id, key(), new Date(), { size: "S", delivery: { ...ADDRESS, name: "Arjun Rao" } });
  assert.equal(again.order.size, "S");
  assert.deepEqual((await getLastDeliveryAddress(b))?.name, "Arjun Rao");

  // Admin: the queue shows the full address; pack, ship, deliver.
  const queue = await listMerchOrdersForAdmin("to_pack");
  const row = queue.find((o) => o.id === again.order.id)!;
  assert.equal(row.delivery?.line1, ADDRESS.line1);
  assert.equal(row.delivery?.phone, "9876543210");
  await updateMerchShipment("admin_test", again.order.id, "pack");
  await assert.rejects(cancelMyMerchOrder(b, again.order.id), code("too_late"), "packing has started");
  await assert.rejects(updateMerchShipment("admin_test", again.order.id, "ship", { courier: "Delhivery", trackingNo: "x" }), code("invalid_shipment"));
  const shipped = await updateMerchShipment("admin_test", again.order.id, "ship", { courier: "Delhivery", trackingNo: "DLV-12345678" });
  assert.equal(shipped.trackingNo, "DLV-12345678");
  await assert.rejects(updateMerchShipment("admin_test", again.order.id, "cancel", { reason: "Changed my mind" }), code("invalid_state"));
  const delivered = await updateMerchShipment("admin_test", again.order.id, "deliver");
  assert.equal(delivered.status, "fulfilled");

  // An admin cancel needs a reason and refunds.
  const c = await buyer();
  const third = await buyStoreItem(c, tee.id, key(), new Date(), { size: "M", delivery: ADDRESS });
  await assert.rejects(updateMerchShipment("admin_test", third.order.id, "cancel", { reason: "" }), code("reason_required"));
  await updateMerchShipment("admin_test", third.order.id, "cancel", { reason: "Out of this colour" });
  assert.equal((await getWalletBalance(c)).available, WELCOME);
  assert.equal((await rawPool().query(`SELECT size_stock FROM store.items WHERE id = $1`, [tee.id])).rows[0].size_stock.M, 2, "stock back");

  // 90 days after delivery the address is wiped.
  await rawPool().query(`UPDATE store.orders SET delivered_at = NOW() - interval '91 days' WHERE id = $1`, [again.order.id]);
  assert.ok((await purgeOldDeliveryAddresses()) >= 1);
  const mine = (await listMyOrders(b)).find((o) => o.id === again.order.id)!;
  assert.equal(mine.deliverTo, null);
  await assertLedgerBalanced();

  // Switched off again: merch disappears and cannot be bought.
  await setFeatures({ merch: false });
  assert.equal((await listStoreItems(a)).items.some((i) => i.id === tee.id), false);
  await assert.rejects(buyStoreItem(a, tee.id, key(), new Date(), { size: "M", delivery: ADDRESS }), code("not_on_sale"));
});
