/**
 * A3 — privileged routes re-check the principal on every request.
 *
 * `requireRole(["admin"|"teacher"])` does one PK lookup after the JWT check:
 * the row must still exist, be active, hold the same role, and carry the same
 * auth_token_version. Any mismatch → 401 (sign in again). A lookup failure is
 * a 503 (AuthServiceUnavailableError), never a silent pass. Plain
 * `requireAuth` (the student hot path) stays JWT-only on purpose.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  assertFreshPrincipal,
  AuthzError,
  authzErrorResponse,
  requireAuth,
  requireRole,
} from "@/server/authz";
import { AuthServiceUnavailableError } from "@/server/auth-errors";
import {
  ACCESS_COOKIE_NAME,
  ACCESS_FINGERPRINT_COOKIE_NAME,
  issueAccessTokenForUser,
} from "@/server/auth-jwt";
import { readStoreAsync, resetStore, withStoredUserDefaults, type StoredUser } from "@/server/store";

process.env.AUTH_JWT_SECRET_CURRENT = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY";

function buildUser(patch: Partial<StoredUser> = {}): StoredUser {
  return withStoredUserDefaults({
    id: "user_admin_1",
    name: "Admin",
    email: "admin@example.com",
    password: "",
    role: "admin",
    studentClass: null,
    fieldOfInterest: null,
    referralSource: null,
    avatar: null,
    streak: 0,
    totalStudyTime: 0,
    joinedAt: new Date(0).toISOString(),
    isPremium: false,
    premiumExpiry: null,
    isOnboarded: true,
    selectedCourse: null,
    isDropper: false,
    yearsOfExperience: null,
    subjects: [],
    studentCapacity: null,
    ...patch,
  });
}

const ctx = { userId: "user_admin_1", role: "admin" as const, tokenVersion: 2 };

async function rejectsWith401(run: () => Promise<unknown>) {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof AuthzError, "expected an AuthzError");
    assert.equal(error.status, 401);
    return true;
  });
}

test("a matching active row passes", async () => {
  await assertFreshPrincipal(ctx, async () => buildUser({ authTokenVersion: 2 }));
});

test("a revoked account is rejected with 401", async () => {
  await rejectsWith401(() =>
    assertFreshPrincipal(ctx, async () => buildUser({ authTokenVersion: 2, accountStatus: "revoked" })),
  );
});

test("a deleted account is rejected with 401", async () => {
  await rejectsWith401(() =>
    assertFreshPrincipal(ctx, async () => buildUser({ authTokenVersion: 2, accountStatus: "deleted" })),
  );
});

test("an auth_token_version bump invalidates the token", async () => {
  await rejectsWith401(() => assertFreshPrincipal(ctx, async () => buildUser({ authTokenVersion: 3 })));
});

test("a role that no longer matches the JWT claim is rejected", async () => {
  // Sub-admin demoted to student while their JWT still says role: admin.
  await rejectsWith401(() =>
    assertFreshPrincipal(ctx, async () => buildUser({ authTokenVersion: 2, role: "student" })),
  );
});

test("a missing row is rejected", async () => {
  await rejectsWith401(() => assertFreshPrincipal(ctx, async () => null));
});

test("a lookup failure is an outage (503), not a pass and not a denial", async () => {
  await assert.rejects(
    assertFreshPrincipal(ctx, async () => {
      throw new Error("connection reset");
    }),
    AuthServiceUnavailableError,
  );
  const response = authzErrorResponse(new AuthServiceUnavailableError());
  assert.equal(response.status, 503);
});

// ─── End-to-end through requireRole on the seed store ─────────────────────────

/** These exercise the seed-store path, so make sure Postgres is not picked up. */
function withoutPostgres<T>(run: () => Promise<T>): Promise<T> {
  const previous = process.env.USER_DATABASE_URL;
  delete process.env.USER_DATABASE_URL;
  return run().finally(() => {
    if (previous) process.env.USER_DATABASE_URL = previous;
  });
}

async function requestFor(user: StoredUser): Promise<Request> {
  const issued = await issueAccessTokenForUser(user, "sess_test");
  return new Request("https://www.o3origin.com/api/admin/users", {
    headers: {
      cookie: `${ACCESS_COOKIE_NAME}=${issued.accessToken}; ${ACCESS_FINGERPRINT_COOKIE_NAME}=${issued.accessFingerprint}`,
    },
  });
}

test("requireRole(admin) passes for a current admin and fails once the version moves", async () => {
  await withoutPostgres(async () => {
    resetStore();
    const store = await readStoreAsync();
    const admin = store.users.find((entry) => entry.role === "admin");
    assert.ok(admin, "seed store has an admin");

    const current = await requestFor(admin);
    const context = await requireRole(current, ["admin"]);
    assert.equal(context.userId, admin.id);

    // A token minted under a version the row no longer carries (revoke /
    // sub-admin removal bumps it) is refused on the next admin call.
    const stale = await requestFor({ ...admin, authTokenVersion: (admin.authTokenVersion ?? 0) + 1 });
    await rejectsWith401(() => requireRole(stale, ["admin"]));

    // ...but plain requireAuth is deliberately JWT-only (student hot path).
    const hot = await requireAuth(stale);
    assert.equal(hot.userId, admin.id);
  });
});

test("requireRole(admin) refuses a JWT whose role claim the row no longer backs", async () => {
  await withoutPostgres(async () => {
    resetStore();
    const store = await readStoreAsync();
    const student = store.users.find((entry) => entry.role === "student");
    assert.ok(student, "seed store has a student");

    // Forged/stale claim: the token says admin, the row says student.
    const request = await requestFor({ ...student, role: "admin" });
    await rejectsWith401(() => requireRole(request, ["admin"]));
  });
});

test("requireRole(student) stays JWT-only (no freshness lookup)", async () => {
  await withoutPostgres(async () => {
    resetStore();
    const store = await readStoreAsync();
    const student = store.users.find((entry) => entry.role === "student");
    assert.ok(student, "seed store has a student");

    const stale = await requestFor({ ...student, authTokenVersion: (student.authTokenVersion ?? 0) + 7 });
    const context = await requireRole(stale, ["student"]);
    assert.equal(context.userId, student.id);
  });
});
