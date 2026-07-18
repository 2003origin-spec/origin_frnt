import assert from "node:assert/strict";
import { test } from "node:test";

import bcrypt from "bcryptjs";

import {
  anonymizedPatch,
  applyAccountDeletionToStore,
  tombstoneEmail,
} from "@/server/account-deletion";
import { withStoredUserDefaults, type AppStore, type StoredUser } from "@/server/store";

function makeUser(overrides: Partial<StoredUser>): StoredUser {
  return withStoredUserDefaults({
    id: "user-1",
    name: "Asha Student",
    email: "asha@example.com",
    password: bcrypt.hashSync("secret-password", 4),
    role: "student",
    joinedAt: new Date().toISOString(),
    ...overrides,
  } as StoredUser);
}

function makeStore(users: StoredUser[]): AppStore {
  return {
    users,
    authSessions: [
      {
        id: "sess-1",
        accessToken: "at-1",
        refreshToken: "rt-1",
        userId: "user-1",
        createdAt: new Date().toISOString(),
        accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
        refreshTokenExpiresAt: new Date(Date.now() + 600_000).toISOString(),
      },
      {
        id: "sess-2",
        accessToken: "at-2",
        refreshToken: "rt-2",
        userId: "user-2",
        createdAt: new Date().toISOString(),
        accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
        refreshTokenExpiresAt: new Date(Date.now() + 600_000).toISOString(),
      },
    ],
  } as unknown as AppStore;
}

test("tombstone email is per-user, non-deliverable, and collision-free", () => {
  assert.equal(tombstoneEmail("abc"), "deleted-abc@deleted.invalid");
  assert.notEqual(tombstoneEmail("a"), tombstoneEmail("b"));
});

test("anonymized patch destroys every PII field and premium state", () => {
  const patch = anonymizedPatch("user-1");
  assert.equal(patch.name, "Deleted user");
  assert.equal(patch.email, tombstoneEmail("user-1"));
  assert.equal(patch.mobile, null);
  assert.equal(patch.avatar, null);
  assert.equal(patch.username, null);
  assert.equal(patch.profilePrivate, true);
  assert.equal(patch.isPremium, false);
  assert.equal(patch.premiumExpiry, null);
  // Password hash replaced with a hash of random bytes — old password dead.
  assert.ok(patch.password && patch.password.startsWith("$2"));
  assert.ok(!bcrypt.compareSync("secret-password", patch.password));
});

test("store deletion anonymizes in place, revokes sessions, keeps the row (seed-resurrection guard)", async () => {
  const user = makeUser({});
  const bystander = makeUser({ id: "user-2", email: "other@example.com" });
  const store = makeStore([user, bystander]);
  const originalVersion = user.authTokenVersion ?? 0;

  const found = await applyAccountDeletionToStore(store, "user-1");
  assert.equal(found, true);

  // Row is retained — the legacy-store demo-seed hydration re-materializes
  // MISSING rows (the PR #235/#113 resurrection bug); keeping the row means
  // there is nothing to resurrect. Count must be invariant.
  assert.equal(store.users.length, 2);

  // Identity destroyed; original email no longer findable (what any seed/DB
  // union lookup keys on), so the identity cannot come back.
  const byOldEmail = store.users.find((entry) => entry.email.toLowerCase() === "asha@example.com");
  assert.equal(byOldEmail, undefined);
  assert.equal(user.name, "Deleted user");
  assert.equal(user.email, tombstoneEmail("user-1"));
  assert.equal(user.mobile, null);
  assert.equal(user.avatar, null);
  assert.equal(user.username, null);

  // Sessions: the deleted user's revoked, the bystander's untouched.
  assert.ok(store.authSessions.find((s) => s.id === "sess-1")?.revokedAt);
  assert.equal(store.authSessions.find((s) => s.id === "sess-2")?.revokedAt, undefined);

  // In-flight access JWTs are invalidated by the version bump.
  assert.equal(user.authTokenVersion, originalVersion + 1);

  // Unknown user: no-op, reported as not found.
  assert.equal(await applyAccountDeletionToStore(store, "ghost"), false);
});
