/**
 * Server-side auth helpers for React Server Components.
 *
 * Reads the access token from the HttpOnly cookie set by the auth API route
 * (or by Server Actions), then resolves it to a user by checking the mirrored
 * flat-file session first and only falling back to Postgres when needed.
 *
 * Safe to call from any async RSC or Server Action — never import this in
 * 'use client' components.
 */

import { cookies } from 'next/headers';
import { isUserPostgresConfigured } from '@/server/user-postgres';
import { dbFindUserByAccessToken } from '@/server/db-users';
import { readStore } from '@/server/store';
import { findUserByAccessToken } from '@/server/auth';
import { serializeUser } from '@/server/users';
import type { AppStore, StoredUser } from '@/server/store';
import type { User } from '@/types';

type ServerAuthResolution = {
  user: StoredUser | null;
  store: AppStore | null;
};

async function resolveServerAuth(): Promise<ServerAuthResolution> {
  const cookieStore = await cookies();
  const token = cookieStore.get('origin_access_token')?.value;
  if (!token) {
    return { user: null, store: null };
  }

  const store = readStore();
  const localUser = findUserByAccessToken(store, token);
  if (localUser) {
    return { user: localUser, store };
  }

  // Fall back to the DB session table when the mirrored local session is stale or missing.
  if (isUserPostgresConfigured()) {
    try {
      const dbUser = await dbFindUserByAccessToken(token);
      if (dbUser) {
        return { user: dbUser, store };
      }
    } catch (err) {
      console.error('[auth-server] DB token check failed, falling back to flat-file', err);
    }
  }

  return { user: null, store };
}

export async function getServerUser(): Promise<StoredUser | null> {
  return (await resolveServerAuth()).user;
}

/**
 * Resolves the current request to a frontend-shape `User` suitable for
 * seeding `AuthProvider` in the root layout. Returns `null` when the user
 * is not authenticated — callers should handle that case by rendering the
 * public surface of the app.
 */
export async function getServerFrontendUser(): Promise<User | null> {
  const { user: stored, store: resolvedStore } = await resolveServerAuth();
  if (!stored) return null;

  const store = resolvedStore ?? readStore();
  const payload = serializeUser(store, stored.id);
  return (payload as unknown as User) ?? null;
}
