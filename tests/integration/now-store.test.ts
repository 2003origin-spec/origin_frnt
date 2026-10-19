/**
 * Origin Store pilot against a real Postgres: coin premium becomes a
 * coin_redemption subject grant (stacking, premium flag recomputed), papers
 * are bought once and downloaded only by their owner, purchases are
 * idempotent and all-or-nothing, and the admin rules hold.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { getWalletBalance } from "@/server/now/ledger-store";
import {
  buyStoreItem,
  confirmPaperUpload,
  createPaperUpload,
  getPaperDownload,
  listStoreItems,
  upsertStoreItem,
} from "@/server/now/store-service";

import { closePool, rawPool } from "./_db";
import { NOW_SKIP, WELCOME, assertLedgerBalanced, cleanupNowFixtures, seedStudent, seedUser, setup } from "./_now";

const savedEnv = { ...process.env };

test.before(() => {
  process.env.R2_ENDPOINT = "https://acct.r2.cloudflarestorage.invalid";
  process.env.R2_ACCESS_KEY_ID = "app-key";
  process.env.R2_SECRET_ACCESS_KEY = "app-secret";
  process.env.R2_BUCKET_NAME = "origin";
  process.env.R2_PRIVATE_BUCKET = "origin-private";
});

test.after(async () => {
  process.env = savedEnv;
  await cleanupNowFixtures();
  await closePool();
});

const DAY = 24 * 60 * 60_000;

test("coin premium: a coin_redemption grant that stacks, flips is_premium, and is idempotent", { skip: NOW_SKIP }, async () => {
  await setup();
  const student = await seedStudent();
  await getWalletBalance(student); // account exists
  await (await import("@/server/now/wallet-service")).ensureWelcomeGrant(student);
  const item = await upsertStoreItem({ kind: "premium", title: "Physics premium, 30 days", priceCoins: 50, premiumSubject: "physics", premiumDays: 30 });

  const before = Date.now();
  const first = await buyStoreItem(student, item.id, "key-1");
  assert.equal(first.order.status, "fulfilled");
  const expiry1 = new Date(first.order.premiumExpiresAt!).getTime();
  assert.ok(Math.abs(expiry1 - (before + 30 * DAY)) < 60_000);

  const replay = await buyStoreItem(student, item.id, "key-1");
  assert.equal(replay.order.id, first.order.id, "same key, same order");
  assert.equal((await getWalletBalance(student)).available, WELCOME - 50, "charged once");

  const second = await buyStoreItem(student, item.id, "key-2");
  assert.ok(Math.abs(new Date(second.order.premiumExpiresAt!).getTime() - (expiry1 + 30 * DAY)) < 1_000, "stacks after the first");

  const grants = await rawPool().query(
    `SELECT source, status, subject FROM entitlements.subject_grants WHERE user_id = $1 ORDER BY expires_at`,
    [student],
  );
  assert.deepEqual(grants.rows.map((g) => g.source), ["coin_redemption", "coin_redemption"]);
  const user = await rawPool().query(`SELECT is_premium, premium_expiry FROM origin_users WHERE id = $1`, [student]);
  assert.equal(user.rows[0].is_premium, true);

  const view = await listStoreItems(student);
  assert.ok(view.items.find((i) => i.id === item.id)?.coinPremiumUntil);
  await assertLedgerBalanced();
});

test("not enough coins → nothing happens: no order, no grant, no debit", { skip: NOW_SKIP }, async () => {
  await setup();
  const student = await seedStudent();
  await (await import("@/server/now/wallet-service")).ensureWelcomeGrant(student);
  const pricey = await upsertStoreItem({ kind: "premium", title: "Biology premium, a year", priceCoins: WELCOME + 1, premiumSubject: "biology", premiumDays: 365 });
  await assert.rejects(buyStoreItem(student, pricey.id, "k"), /Not enough coins/);
  const orders = await rawPool().query(`SELECT count(*)::int AS n FROM store.orders WHERE user_id = $1`, [student]);
  assert.equal(orders.rows[0].n, 0);
  const grants = await rawPool().query(`SELECT count(*)::int AS n FROM entitlements.subject_grants WHERE user_id = $1`, [student]);
  assert.equal(grants.rows[0].n, 0);
  assert.equal((await getWalletBalance(student)).available, WELCOME);
});

test("papers: off until uploaded, bought once, downloaded only by the owner; stock runs out", { skip: NOW_SKIP }, async () => {
  await setup();
  const paper = await upsertStoreItem({ kind: "digital", title: "JEE Main 2025 Shift 1", priceCoins: 20, active: true, stock: 1 });
  assert.equal(paper.active, false, "a paper starts off until its file is uploaded");
  await assert.rejects(createPaperUpload(paper.id, { mimeType: "image/png", sizeBytes: 100 }), /PDF/);
  const upload = await createPaperUpload(paper.id, { mimeType: "application/pdf", sizeBytes: 2048 });
  assert.match(upload.uploadUrl, /X-Amz-Signature=/);
  assert.match(upload.uploadUrl, /\/origin-private\/origin-now\/store\//, "papers go to the private bucket (B96)");
  await assert.rejects(confirmPaperUpload(paper.id, "origin-now/store/other/x.pdf"), /does not belong/);
  await confirmPaperUpload(paper.id, upload.objectKey);
  await upsertStoreItem({ id: paper.id, kind: "digital", title: "JEE Main 2025 Shift 1", priceCoins: 20, active: true, stock: 1 });

  const buyer = await seedStudent();
  await (await import("@/server/now/wallet-service")).ensureWelcomeGrant(buyer);
  const bought = await buyStoreItem(buyer, paper.id, "p1");
  assert.equal(bought.order.canDownload, true);
  const again = await buyStoreItem(buyer, paper.id, "p2");
  assert.equal(again.alreadyOwned, true);
  assert.equal(again.order.id, bought.order.id);
  assert.equal((await getWalletBalance(buyer)).available, WELCOME - 20, "never charged twice for the same paper");

  const link = await getPaperDownload(buyer, bought.order.id);
  assert.match(link.url, new RegExp(upload.objectKey.replace(/[.]/g, "\\.")));
  assert.match(link.url, /\/origin-private\//);
  const someoneElse = await seedStudent();
  await assert.rejects(getPaperDownload(someoneElse, bought.order.id), /not found/i);
  await (await import("@/server/now/wallet-service")).ensureWelcomeGrant(someoneElse);
  await assert.rejects(buyStoreItem(someoneElse, paper.id, "p3"), /sold out/);

  const downloads = await rawPool().query(`SELECT downloads FROM store.orders WHERE id = $1`, [bought.order.id]);
  assert.equal(downloads.rows[0].downloads, 1);
  await assertLedgerBalanced();
});

test("the store is for pilot members; admins cannot list merch or rupee prices yet", { skip: NOW_SKIP }, async () => {
  await setup();
  const outsider = await seedUser("Not Invited");
  await assert.rejects(listStoreItems(outsider), /pilot members/);
  await assert.rejects(upsertStoreItem({ kind: "merch", title: "Hoodie", priceCoins: 900 }), /Switch on "Merch in the store"/);
  await assert.rejects(
    upsertStoreItem({ kind: "premium", title: "Mixed", priceCoins: 10, pricePaise: 100, premiumSubject: "physics", premiumDays: 7 }),
    /after the pilot/,
  );
});

test("paid papers never use the public bucket: no private bucket, or the public one named, refuses uploads (B96)", { skip: NOW_SKIP }, async () => {
  await setup();
  const paper = await upsertStoreItem({ kind: "digital", title: "Bucket check", priceCoins: 5, active: false });
  const saved = process.env.R2_PRIVATE_BUCKET;
  try {
    delete process.env.R2_PRIVATE_BUCKET;
    await assert.rejects(createPaperUpload(paper.id, { mimeType: "application/pdf", sizeBytes: 10 }), (e: { code?: string }) => e.code === "storage_unavailable");
    process.env.R2_PRIVATE_BUCKET = "ORIGIN";
    await assert.rejects(createPaperUpload(paper.id, { mimeType: "application/pdf", sizeBytes: 10 }), (e: { code?: string }) => e.code === "storage_unavailable");
  } finally {
    process.env.R2_PRIVATE_BUCKET = saved;
  }
});
