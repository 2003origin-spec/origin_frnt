/**
 * Account deletion (ANDROID_HYBRID_APP_PLAN.md §5.6 — Google Play hard
 * requirement: an in-app path plus a public web URL must let users delete
 * their account).
 *
 * Strategy: **anonymize-in-place**, immediately and irreversibly.
 *  - The user row is kept (FKs to attempts/results/subscriptions stay valid;
 *    aggregate stats like leaderboards keep integrity) but every piece of PII
 *    is destroyed: name, email → per-id tombstone, mobile, avatar, social
 *    handle; the password hash is replaced with a hash of random bytes.
 *  - All auth sessions are revoked (auth token version bump) and every FCM
 *    device token is unbound.
 *  - Active Razorpay subject subscriptions are cancelled first, best-effort —
 *    a deleted account must never keep charging a mandate. Failures are
 *    surfaced as warnings, never blockers: deletion always completes.
 *
 * Keeping the row also closes the legacy-store "seed resurrection" class of
 * bug by construction — nothing is removed, so nothing can be re-materialized
 * with the original identity (see tests/account-deletion.test.ts).
 */

import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";

import { clearUserSessions } from "@/server/auth";
import {
  dbFindUserById,
  dbIncrementAuthTokenVersionAndRevokeSessions,
  dbUpdateUser,
} from "@/server/db-users";
import { revokeDeviceTokensForUser } from "@/server/push/device-tokens";
import { isUserPostgresConfigured } from "@/server/user-postgres";
import { withStoreAsync } from "@/server/store";
import type { AppStore, StoredUser } from "@/server/store";

export type AccountDeletionResult = {
  ok: true;
  /** Non-fatal issues (e.g. a subscription cancel that must be retried by support). */
  warnings: string[];
};

export function tombstoneEmail(userId: string): string {
  // `.invalid` is an IETF reserved TLD — can never receive mail, can never
  // collide with a real signup, and is trivially recognizable in the DB.
  return `deleted-${userId}@deleted.invalid`;
}

export function anonymizedPatch(userId: string): Partial<StoredUser> {
  return {
    name: "Deleted user",
    email: tombstoneEmail(userId),
    password: bcrypt.hashSync(randomBytes(32).toString("hex"), 10),
    passwordSet: true,
    mobile: null,
    avatar: null,
    username: null,
    profilePrivate: true,
    isPremium: false,
    premiumExpiry: null,
  };
}

export async function cancelActiveSubscriptions(userId: string, warnings: string[]): Promise<void> {
  // Lazy import: the subscriptions surface is feature-flagged and touches the
  // Razorpay client; deletion must work even when that stack is dark.
  try {
    const { cancelSubjectSubscription, listMySubscriptions } = await import(
      "@/server/subscriptions/subscriptions-service"
    );
    const subscriptions = await listMySubscriptions(userId);
    for (const subscription of subscriptions) {
      const status = (subscription as { status?: string }).status ?? "";
      if (!["active", "authenticated", "pending"].includes(status)) continue;
      try {
        await cancelSubjectSubscription({ userId, subject: subscription.subject });
      } catch (error) {
        warnings.push(
          `Could not cancel the ${subscription.subject} subscription automatically — it may need manual cancellation.`,
        );
        console.error(
          "[account-deletion] subject subscription cancel failed",
          subscription.subject,
          error instanceof Error ? error.message : error,
        );
      }
    }
  } catch (error) {
    // Schema dark / Razorpay unconfigured: nothing to cancel.
    console.warn(
      "[account-deletion] subscription sweep skipped:",
      error instanceof Error ? error.message : error,
    );
  }
  // NOTE: Connect batch-tuition mandates (enrollment_subscriptions) have no
  // per-user cancel API yet; the reconcile drain tears them down when they
  // lapse. Tracked in ANDROID_HYBRID_APP_PLAN.md §5.6 as a follow-up.
}

/**
 * Legacy-store deletion: anonymize the user IN PLACE (the row is never
 * removed, so the demo-seed hydration path has nothing to resurrect — the
 * store row count is invariant) and revoke every session. Exported for the
 * regression test. Returns whether a user was found.
 */
export async function applyAccountDeletionToStore(store: AppStore, userId: string): Promise<boolean> {
  const user = store.users.find((entry) => entry.id === userId);
  if (!user) return false;
  Object.assign(user, anonymizedPatch(userId));
  user.authTokenVersion = (user.authTokenVersion ?? 0) + 1;
  await clearUserSessions(store, userId);
  return true;
}

export async function deleteAccountForUser(userId: string): Promise<AccountDeletionResult> {
  const warnings: string[] = [];

  await cancelActiveSubscriptions(userId, warnings);

  if (isUserPostgresConfigured()) {
    const user = await dbFindUserById(userId);
    if (user) {
      await dbUpdateUser(userId, anonymizedPatch(userId));
      // Bumps auth_token_version AND revokes every session — in-flight access
      // JWTs die at the next check, refresh tokens are gone.
      await dbIncrementAuthTokenVersionAndRevokeSessions(userId);
    }
  } else {
    await withStoreAsync(async (store) => {
      await applyAccountDeletionToStore(store, userId);
    });
  }

  try {
    await revokeDeviceTokensForUser(userId);
  } catch (error) {
    console.error(
      "[account-deletion] push token revoke failed",
      error instanceof Error ? error.message : error,
    );
  }

  return { ok: true, warnings };
}
