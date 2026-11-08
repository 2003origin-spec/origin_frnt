'use server';

import { revalidatePath, revalidateTag } from 'next/cache';

import { getServerUser } from '@/lib/auth-server';
import { withStoreAsyncScoped } from '@/server/store';
import { serializeUser } from '@/server/users';
import { isUserPostgresConfigured, getUserPostgresPool } from '@/server/user-postgres';
import { dbUpdateUser } from '@/server/db-users';
import { ensureSocialSchema } from '@/server/social/social-schema';
import {
  normalizeUsername,
  isValidUsername,
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
} from '@/server/social/username';
import type { StoredUser } from '@/server/store';
import type { User } from '@/types';

export type UpdateSocialSettingsInput = {
  username?: string;
  profilePrivate?: boolean;
};

async function isUsernameTaken(username: string, selfId: string): Promise<boolean> {
  const pool = getUserPostgresPool();
  if (!pool) return false;
  const res = await pool.query(
    'SELECT 1 FROM origin_users WHERE LOWER(username) = LOWER($1) AND id <> $2 LIMIT 1',
    [username, selfId],
  );
  return (res.rowCount ?? 0) > 0;
}

/** Update the viewer's @username and/or profile-privacy toggle. */
export async function updateSocialSettingsAction(input: UpdateSocialSettingsInput): Promise<User> {
  const current = await getServerUser();
  if (!current) throw new Error('Not authenticated.');
  await ensureSocialSchema();

  let normalizedUsername: string | undefined;
  if (typeof input.username === 'string') {
    normalizedUsername = normalizeUsername(input.username);
    if (!isValidUsername(normalizedUsername)) {
      throw new Error(
        `Username must be ${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} characters using lowercase letters, numbers, or underscores.`,
      );
    }
    if (normalizedUsername !== (current.username ?? '').toLowerCase()) {
      if (await isUsernameTaken(normalizedUsername, current.id)) {
        throw new Error('That username is already taken.');
      }
    }
  }

  const profilePrivate = typeof input.profilePrivate === 'boolean' ? input.profilePrivate : undefined;
  if (normalizedUsername === undefined && profilePrivate === undefined) {
    throw new Error('Nothing to update.');
  }

  // Durable write FIRST (review L9): the targeted dbUpdateUser also maps the
  // username unique-violation to a friendly error. Only once it has succeeded
  // is the in-memory store updated, so a clash can never leave this instance's
  // store cache holding two users with the same username.
  if (isUserPostgresConfigured()) {
    const patch: Partial<StoredUser> = {};
    if (normalizedUsername !== undefined) patch.username = normalizedUsername;
    if (profilePrivate !== undefined) patch.profilePrivate = profilePrivate;
    try {
      await dbUpdateUser(current.id, patch);
    } catch (err) {
      // Unique-violation race on the username index → friendly message.
      if ((err as { code?: string }).code === '23505') {
        throw new Error('That username is already taken.');
      }
      console.error('[social-actions] Failed to persist social settings:', err);
      throw new Error('Could not save your changes. Please try again.');
    }
  }

  // In-memory update only (null persist): the durable write is above. The old
  // withStoreAsync re-wrote every app.* table here.
  const updated = await withStoreAsyncScoped(async (store) => {
    const user = store.users.find((u) => u.id === current.id);
    if (!user) return null;
    if (normalizedUsername !== undefined) user.username = normalizedUsername;
    if (profilePrivate !== undefined) user.profilePrivate = profilePrivate;
    return (serializeUser(store, current.id) as unknown as User) ?? null;
  }, null);
  if (!updated) throw new Error('Failed to update settings.');

  revalidatePath('/profile');
  revalidatePath('/social');
  revalidateTag('auth-user', 'max');
  revalidateTag(`user:${current.id}`, 'max');
  revalidateTag('leaderboard', 'max');
  return updated;
}
