import test from "node:test";
import assert from "node:assert/strict";

import { DAY_MS, isPaperUpload, paperObjectKey, premiumWindow, validateStoreItem } from "@/server/now/store-rules";

const premium = { kind: "premium", title: "Physics premium, 30 days", priceCoins: 400, premiumSubject: "physics", premiumDays: 30 };

test("pilot items: premium time and digital papers, coins only", () => {
  assert.deepEqual(validateStoreItem(premium), []);
  assert.match(validateStoreItem({ ...premium, kind: "merch" })[0], /premium time and digital papers only/);
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

test("premium redemption takes the per-user lock BEFORE postTransfers locks the wallet row (canonical order)", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../../src/server/now/store-service.ts", import.meta.url), "utf8");
  const buy = src.slice(src.indexOf("export async function buyStoreItem"));
  const lock = buy.indexOf('pg_advisory_xact_lock(hashtext($1))", [userId])');
  const wallet = buy.indexOf("await postTransfers(");
  assert.ok(lock > 0 && wallet > 0, "both calls are present");
  assert.ok(lock < wallet, "user lock first, then now.accounts — a coin-pack refund takes them in that order");
  assert.equal(buy.split("pg_advisory_xact_lock").length - 1, 1, "taken once, not again after the wallet debit");
});
