/**
 * DB-backed round-trip for the admin Premium Pro access toggle. Verifies the two
 * invariants the feature rests on:
 *   1. granting admin_comp flips is_premium true (4 subject rows); revoking flips
 *      it back — via the set-based store + recompute, no per-user loop.
 *   2. a real Razorpay payer is NEVER demoted by a comp revoke (the toggle only
 *      touches source='admin_comp' rows; subscriptions.user_subscriptions is left
 *      alone, and the mirror re-unions the still-active paid row).
 * Skips when USER_DATABASE_URL is not configured (safe on a bare dev box).
 */

import test from "node:test";
import assert from "node:assert/strict";

import { dbConfigured, rawPool, makeId } from "./_db";
import { ensureUserSchema } from "@/server/db-users";
import { ensureSubscriptionsSchema } from "@/server/subscriptions/subscriptions-schema";
import {
  grantAdminCompToUsers,
  revokeAllAdminComp,
  expireLapsedSubjectGrants,
} from "@/server/connect/subject-grants-store";
import { recomputePremiumFlagsForUsers } from "@/server/entitlements";

const maybe = dbConfigured() ? test : test.skip;

async function seedStudent(): Promise<string> {
  const id = makeId("user_prem");
  await rawPool().query(
    `INSERT INTO origin_users (id, name, email, role, password_hash)
     VALUES ($1, 'Prem Test', $2, 'student', 'test-no-login') ON CONFLICT (id) DO NOTHING`,
    [id, `${id}@example.com`],
  );
  return id;
}

async function isPremium(id: string): Promise<boolean> {
  const r = await rawPool().query<{ is_premium: boolean }>(`SELECT is_premium FROM origin_users WHERE id = $1`, [id]);
  return r.rows[0]?.is_premium === true;
}

async function activeCompCount(id: string): Promise<number> {
  const r = await rawPool().query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM entitlements.subject_grants
      WHERE user_id = $1 AND source = 'admin_comp' AND status = 'active'`,
    [id],
  );
  return r.rows[0].c;
}

maybe("grant/revoke admin_comp flips is_premium and never demotes a paying user", async () => {
  await ensureUserSchema();
  await ensureSubscriptionsSchema();

  const freeA = await seedStudent();
  const freeB = await seedStudent();
  const paid = await seedStudent();

  // The paying student holds an active Razorpay subscription (physics).
  await rawPool().query(
    `INSERT INTO subscriptions.user_subscriptions (id, user_id, subject, status)
     VALUES ($1, $2, 'physics', 'active')`,
    [makeId("sub"), paid],
  );

  try {
    // Grant full Premium Pro (admin_comp) to the two free students.
    const g = await grantAdminCompToUsers({ userIds: [freeA, freeB], grantedBy: null });
    assert.equal(g.userIds.length, 2);
    await recomputePremiumFlagsForUsers([freeA, freeB, paid]);

    assert.equal(await isPremium(freeA), true, "freeA premium after grant");
    assert.equal(await isPremium(freeB), true, "freeB premium after grant");
    assert.equal(await activeCompCount(freeA), 4, "freeA has all 4 subject grants");
    assert.equal(await activeCompCount(paid), 0, "paid user was never comp-granted");
    assert.equal(await isPremium(paid), true, "paid user premium from subscription");

    // Revoke ALL comp grants — must not touch the paying user.
    await revokeAllAdminComp();
    await recomputePremiumFlagsForUsers([freeA, freeB, paid]);

    assert.equal(await isPremium(freeA), false, "freeA reverted to free");
    assert.equal(await isPremium(freeB), false, "freeB reverted to free");
    assert.equal(await isPremium(paid), true, "paid user STILL premium (protected)");

    const sub = await rawPool().query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM subscriptions.user_subscriptions WHERE user_id = $1 AND status = 'active'`,
      [paid],
    );
    assert.equal(sub.rows[0].c, 1, "subscription row untouched by the comp revoke");
  } finally {
    await rawPool().query(`DELETE FROM subscriptions.user_subscriptions WHERE user_id = ANY($1)`, [[paid]]);
    await rawPool().query(`DELETE FROM entitlements.subject_grants WHERE user_id = ANY($1)`, [[freeA, freeB, paid]]);
    await rawPool().query(`DELETE FROM origin_users WHERE id = ANY($1)`, [[freeA, freeB, paid]]);
  }
});

maybe("expireLapsedSubjectGrants marks past-due grants expired", async () => {
  await ensureUserSchema();
  const u = await seedStudent();
  const past = new Date(Date.now() - 60_000).toISOString();
  try {
    await grantAdminCompToUsers({ userIds: [u], grantedBy: null, expiresAt: past });
    await recomputePremiumFlagsForUsers([u]);
    // A lapsed grant is not entitled, so the mirror is already false.
    assert.equal(await isPremium(u), false, "lapsed grant does not confer premium");

    const ex = await expireLapsedSubjectGrants();
    assert.ok(ex.userIds.includes(u), "user reported among expired");
    const st = await rawPool().query<{ status: string }>(
      `SELECT status FROM entitlements.subject_grants WHERE user_id = $1 LIMIT 1`,
      [u],
    );
    assert.equal(st.rows[0].status, "expired", "grant marked expired");
  } finally {
    await rawPool().query(`DELETE FROM entitlements.subject_grants WHERE user_id = $1`, [u]);
    await rawPool().query(`DELETE FROM origin_users WHERE id = $1`, [u]);
  }
});
