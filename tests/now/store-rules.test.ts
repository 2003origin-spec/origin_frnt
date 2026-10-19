import test from "node:test";
import assert from "node:assert/strict";

import {
  DAY_MS,
  addressSummary,
  isPaperUpload,
  merchImageObjectKey,
  nextShipStatus,
  normalizeIndianMobile,
  paperObjectKey,
  parseSizeStock,
  premiumWindow,
  sortSizes,
  validateDeliveryAddress,
  validateShipment,
  validateStoreItem,
} from "@/server/now/store-rules";

const premium = { kind: "premium", title: "Physics premium, 30 days", priceCoins: 400, premiumSubject: "physics", premiumDays: 30 };

test("pilot items: premium time and digital papers, coins only", () => {
  assert.deepEqual(validateStoreItem(premium), []);
  assert.match(validateStoreItem({ ...premium, kind: "merch" })[0], /Switch on "Merch in the store"/);
  assert.match(validateStoreItem({ ...premium, pricePaise: 4900 })[0], /after the pilot/);
  assert.match(validateStoreItem({ ...premium, priceCoins: 0 })[0], /above 0/);
  assert.match(validateStoreItem({ ...premium, premiumSubject: "history" })[0], /subject/);
  assert.match(validateStoreItem({ ...premium, premiumDays: 0 })[0], /1 to 366/);
  assert.match(validateStoreItem({ ...premium, stock: -1 })[0], /Stock/);
  const paper = { kind: "digital", title: "JEE 2025 paper", priceCoins: 50 };
  assert.deepEqual(validateStoreItem(paper), []);
  assert.match(validateStoreItem({ ...paper, active: true, hasFile: false })[0], /Upload the paper/);
  assert.deepEqual(validateStoreItem({ ...paper, active: true, hasFile: true }), []);
});

test("coin premium stacks after the current coin premium, never before now", () => {
  const now = new Date("2026-10-17T12:00:00Z");
  assert.equal(premiumWindow(null, 30, now).end.getTime(), now.getTime() + 30 * DAY_MS);
  const later = new Date(now.getTime() + 10 * DAY_MS);
  assert.deepEqual(premiumWindow(later, 30, now), { start: later, end: new Date(later.getTime() + 30 * DAY_MS) });
  const lapsed = new Date(now.getTime() - DAY_MS);
  assert.equal(premiumWindow(lapsed, 7, now).start.getTime(), now.getTime());
});

test("papers are PDFs up to 50 MB under the item's own folder", () => {
  assert.equal(isPaperUpload("application/pdf", 1024), true);
  assert.equal(isPaperUpload("application/PDF", 1024), true);
  assert.equal(isPaperUpload("image/png", 1024), false);
  assert.equal(isPaperUpload("application/pdf", 51 * 1024 * 1024), false);
  assert.equal(isPaperUpload("application/pdf", 0), false);
  assert.equal(paperObjectKey("sitem_1", "abc"), "origin-now/store/sitem_1/abc.pdf");
});

const merchOn = { merch: true, rupeePrices: false };
const tee = { kind: "merch", title: "Origin tee", priceCoins: 600 };

test("merch only once switched on; sizes carry their own stock (B91)", () => {
  assert.deepEqual(validateStoreItem(tee, merchOn), []);
  assert.deepEqual(validateStoreItem({ ...tee, sizeStock: { S: 5, M: 0, XL: 2 } }, merchOn), []);
  assert.match(validateStoreItem({ ...tee, sizeStock: { S: 5 }, stock: 3 }, merchOn)[0], /per size/);
  assert.match(validateStoreItem({ ...premium, sizeStock: { S: 1 } }, merchOn)[0], /Only merch/);
  assert.deepEqual(parseSizeStock({ " M ": 2, L: 0 }), { M: 2, L: 0 });
  assert.equal(parseSizeStock({}), null);
  assert.match(String(parseSizeStock({ "XXXXXXXXXL": 1 })), /1 to 8/);
  assert.match(String(parseSizeStock({ S: -1 })), /whole number/);
  assert.match(String(parseSizeStock(["S"])), /list/);
  assert.deepEqual(sortSizes(["XL", "m", "S", "32", "28", "Free", "XS"]), ["XS", "S", "m", "XL", "28", "32", "Free"]);
  assert.equal(merchImageObjectKey("sitem_1", "abc", "image/png"), "origin-now/store-images/sitem_1/abc.png");
  assert.equal(merchImageObjectKey("sitem_1", "abc", "image/gif"), null);
});

test("delivery addresses: Indian mobile, PIN and state checked; only the place is shown back", () => {
  const good = { name: " Meera  Iyer ", phone: "+91 98765-43210", line1: "12, 3rd Cross, Indiranagar", city: "Bengaluru", state: "karnataka", pincode: "560038" };
  const checked = validateDeliveryAddress(good);
  assert.ok(checked.ok);
  assert.deepEqual(checked.address, { name: "Meera Iyer", phone: "9876543210", line1: "12, 3rd Cross, Indiranagar", line2: null, city: "Bengaluru", state: "Karnataka", pincode: "560038" });
  assert.equal(addressSummary(checked.address), "Bengaluru, Karnataka 560038");
  const bad = validateDeliveryAddress({ ...good, phone: "12345", pincode: "060038", state: "Narnia" });
  assert.ok(!bad.ok);
  assert.equal(bad.errors.length, 3);
  assert.equal(normalizeIndianMobile("09876543210"), "9876543210");
  assert.equal(normalizeIndianMobile("919876543210"), "9876543210");
  assert.equal(normalizeIndianMobile("5876543210"), null, "Indian mobiles start with 6 to 9");
});

test("shipping moves forward only, and cannot be cancelled once it left", () => {
  assert.equal(nextShipStatus("to_pack", "pack"), "packed");
  assert.equal(nextShipStatus("to_pack", "ship"), "shipped");
  assert.equal(nextShipStatus("packed", "ship"), "shipped");
  assert.equal(nextShipStatus("shipped", "deliver"), "delivered");
  assert.equal(nextShipStatus("packed", "cancel"), "cancelled");
  assert.equal(nextShipStatus("shipped", "cancel"), null);
  assert.equal(nextShipStatus("delivered", "pack"), null);
  assert.equal(nextShipStatus("to_pack", "deliver"), null);
  assert.deepEqual(validateShipment("Delhivery", "DLV-123456"), []);
  assert.equal(validateShipment("", "x").length, 2);
});
