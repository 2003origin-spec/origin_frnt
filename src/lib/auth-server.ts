/**
 * Server-side auth helper for React Server Components.
 *
 * Reads the access token from the HttpOnly cookie set by the auth API route,
 * then resolves it to a user using the same DB-first / flat-file-fallback
 * chain as the request-based resolvers.
 *
 * Safe to call from any async RSC or Server Action — never import this in
 * 'use client' components.
 */

import { cookies } from 'next/headers';
import { isUserPostgresConfigured } from '@/server/user-postgres';
import { dbFindUserByAccessToken } from '@/server/db-users';
import { readStore } from '@/server/store';
import { findUserByAccessToken } from '@/server/auth';
import type { StoredUser } from '@/server/store';

export async function getServerUser(): Promise<StoredUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('origin_access_token')?.value;
  if (!token) return null;

  // DB-first (same logic as resolveTokenToUser, but token string instead of Request)
  if (isUserPostgresConfigured()) {
    try {
      const dbUser = await dbFindUserByAccessToken(token);
      if (dbUser) return dbUser;
    } catch (err) {
      console.error('[auth-server] DB token check failed, falling back to flat-file', err);
    }
  }

  const store = readStore();
  return findUserByAccessToken(store, token);
}
