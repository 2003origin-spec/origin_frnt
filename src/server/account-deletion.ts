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
 *  - Denormalised copies of the name / user content elsewhere are purged too
 *    (study-room participant names + chat, doubt sessions, the name inside
 *    other users' notifications) and the in-process store cache is dropped so
 *    the profile stops resolving immediately (see purgeResidualPersonalData).
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
import { purgeLiveContestStateForUser } from "@/server/contest/contest-account-deletion";
import { getOgcodePostgresPool } from "@/server/postgres";
import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";
import { invalidateStoreCache, withStoreAsyncScoped } from "@/server/store";
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
  // Doubt sessions are free-text written by the user — remove them too.
  if (Array.isArray(store.doubtSessions)) {
    store.doubtSessions = store.doubtSessions.filter((session) => session.userId !== userId);
  }
  return true;
}

/** Postgres "relation does not exist" — the table was never created here. */
function isMissingRelation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "42P01";
}

/**
 * Removes PII that lives OUTSIDE `origin_users` as denormalised copies:
 *  - rooms.room_participants.display_name → "Deleted user" (rows kept so room
 *    leaderboards/teacher reports stay consistent),
 *  - rooms.room_messages written by the user → deleted,
 *  - app.doubt_sessions owned by the user → deleted,
 *  - other users' notifications ABOUT this user that embed the name / profile
 *    link ("<name> started following you", "<name> attempted the OG
 *    challenge…", "OG Challenge from <name>") → rewritten, matched on the exact
 *    shape plus this user's handle or follow / challenge edges, never on the
 *    name alone.
 * Each step is independent and best-effort: a failure is reported in
 * `warnings` (a missing table is not a failure) and never blocks deletion.
 * Exported for the unit test.
 */
export async function purgeResidualPersonalData(
  userId: string,
  original: { name: string | null; username: string | null },
  warnings: string[],
): Promise<void> {
  const run = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (error) {
      if (isMissingRelation(error)) return;
      warnings.push(`Could not remove ${label} automatically; support should review.`);
      console.error(
        `[account-deletion] ${label} purge failed`,
        error instanceof Error ? error.message : error,
      );
    }
  };

  const roomsPool = getOgcodePostgresPool();
  if (roomsPool) {
    await run("study-room participant names", () =>
      roomsPool.query(
        `UPDATE rooms.room_participants SET display_name = 'Deleted user' WHERE user_id = $1`,
        [userId],
      ),
    );
    await run("study-room chat messages", () =>
      roomsPool.query(`DELETE FROM rooms.room_messages WHERE user_id = $1`, [userId]),
    );
  }

  const userPool = getUserPostgresPool();
  if (!userPool) return;

  await run("doubt sessions", () =>
    userPool.query(`DELETE FROM app.doubt_sessions WHERE user_id = $1`, [userId]),
  );

  const name = original.name?.trim() || null;
  const username = original.username?.trim() || null;
  if (!name && !username) return;

  // Other users' notifications that embed this user's name / profile link.
  // Only rows provably ABOUT this user are rewritten (review L8): a name alone
  // is not unique (deleting "Rahul" must not touch other Rahuls, deleting a
  // user named "Your" must not touch "Your institute code…"), so every match
  // is tied to an exact notification shape AND to this user's own follow /
  // challenge edges or unique handle. Literal equality only, no LIKE/regex.

  // "<name> started following you" → linked by the unique /u/<handle> href…
  if (username) {
    await run("follow notifications", () =>
      userPool.query(
        `UPDATE app.notifications
            SET message = 'Someone started following you', href = '/social'
          WHERE user_id <> $1 AND title = 'New follower' AND href = '/u/' || $2::text`,
        [userId, username],
      ),
    );
  }
  // …or, for a handle-less follower, the exact message sent to someone this
  // user follows.
  if (name) {
    await run("follow notifications (by name)", () =>
      userPool.query(
        `UPDATE app.notifications
            SET message = 'Someone started following you'
          WHERE user_id <> $1 AND title = 'New follower' AND href = '/social'
            AND message = $2::text || ' started following you'
            AND user_id IN (SELECT following_id FROM social.follows WHERE follower_id = $1)`,
        [userId, name],
      ),
    );
  }

  // OG challenges: recipients of this user's challenges ("OG Challenge from
  // <name>") and senders of challenges this user attempted ("<name> attempted
  // the OG challenge…"), each matched on (recipient, /ogcode/<question>) of a
  // real challenge edge. The edges live on the OGCode pool.
  if (!name || !roomsPool) return;
  const sent: { userIds: string[]; hrefs: string[] } = { userIds: [], hrefs: [] };
  const received: { userIds: string[]; hrefs: string[] } = { userIds: [], hrefs: [] };
  await run("OG challenge notifications", async () => {
    const [out, inc] = await Promise.all([
      roomsPool.query<{ other: string; question_id: string }>(
        `SELECT to_user_id AS other, question_id FROM ogcode_friend_challenges WHERE from_user_id = $1`,
        [userId],
      ),
      roomsPool.query<{ other: string; question_id: string }>(
        `SELECT from_user_id AS other, question_id FROM ogcode_friend_challenges WHERE to_user_id = $1`,
        [userId],
      ),
    ]);
    for (const row of out.rows ?? []) {
      sent.userIds.push(row.other);
      sent.hrefs.push(`/ogcode/${row.question_id}`);
    }
    for (const row of inc.rows ?? []) {
      received.userIds.push(row.other);
      received.hrefs.push(`/ogcode/${row.question_id}`);
    }
  });
  if (sent.userIds.length) {
    await run("OG challenge notifications", () =>
      userPool.query(
        `UPDATE app.notifications
            SET title = 'OG Challenge from a deleted user'
          WHERE user_id <> $1 AND title = 'OG Challenge from ' || $2::text
            AND (user_id, href) IN (SELECT u, h FROM unnest($3::text[], $4::text[]) AS t(u, h))`,
        [userId, name, sent.userIds, sent.hrefs],
      ),
    );
  }
  if (received.userIds.length) {
    await run("OG challenge notifications", () =>
      userPool.query(
        `UPDATE app.notifications
            SET message = 'Someone' || substr(message, length($2::text) + 1)
          WHERE user_id <> $1 AND title = 'OG Challenge attempted'
            AND left(message, length($2::text) + 1) = $2::text || ' '
            AND (user_id, href) IN (SELECT u, h FROM unnest($3::text[], $4::text[]) AS t(u, h))`,
        [userId, name, received.userIds, received.hrefs],
      ),
    );
  }
}

export async function deleteAccountForUser(userId: string): Promise<AccountDeletionResult> {
  const warnings: string[] = [];

  await cancelActiveSubscriptions(userId, warnings);

  if (isUserPostgresConfigured()) {
    // Razorpay Orders have no cancellation API. Close the local intent and
    // release any coupon hold, while surfacing an external order id for support
    // rather than pretending the gateway order disappeared.
    try {
      const { closeOpenPaymentOrdersForUser } = await import("@/server/payments/reconciliation");
      const paymentOrders = await closeOpenPaymentOrdersForUser(userId);
      if (paymentOrders.externalOrderIds.length > 0) {
        warnings.push(
          `Razorpay order(s) ${paymentOrders.externalOrderIds.join(", ")} remain at the gateway and may need support review.`,
        );
      }
    } catch (error) {
      warnings.push("Could not close local payment orders automatically; support should review open checkout attempts.");
      console.error(
        "[account-deletion] payment order cleanup failed",
        error instanceof Error ? error.message : error,
      );
    }
    const user = await dbFindUserById(userId);
    if (user) {
      await dbUpdateUser(userId, anonymizedPatch(userId));
      // Bumps auth_token_version AND revokes every session — in-flight access
      // JWTs die at the next check, refresh tokens are gone.
      await dbIncrementAuthTokenVersionAndRevokeSessions(userId);
      // The name/handle are read BEFORE anonymisation (above) so other users'
      // notifications that embed them can be rewritten.
      await purgeResidualPersonalData(
        userId,
        { name: user.name ?? null, username: user.username ?? null },
        warnings,
      );
    }
  } else {
    // No user Postgres on this branch: the store is the in-memory dev/seed
    // store and the persist would be a no-op, so it is explicitly null.
    await withStoreAsyncScoped(async (store) => {
      await applyAccountDeletionToStore(store, userId);
    }, null);
  }

  try {
    await revokeDeviceTokensForUser(userId);
  } catch (error) {
    console.error(
      "[account-deletion] push token revoke failed",
      error instanceof Error ? error.message : error,
    );
  }

  // Purge transient live contest state (in-progress draft). Contest history/
  // ratings hold no direct PII and are retained for leaderboard integrity;
  // only the live draft must go so no finalize sweep can auto-submit it.
  // Failure here must not block the PII-critical anonymization above.
  try {
    await purgeLiveContestStateForUser(userId);
  } catch (error) {
    console.error(
      "[account-deletion] contest state purge failed",
      error instanceof Error ? error.message : error,
    );
  }

  // Drop this instance's 5-minute store cache so the deleted profile
  // (name/avatar/username/stats) stops resolving on the next read instead of
  // being served from the stale snapshot.
  invalidateStoreCache();

  return { ok: true, warnings };
}
