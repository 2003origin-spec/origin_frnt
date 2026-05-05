import type { AppStore, StoredAuthSession, StoredUser } from "@/server/store";
import { createId, readStoreAsync } from "@/server/store";
import { isUserPostgresConfigured } from "@/server/user-postgres";
import { dbFindUserByAccessToken, dbGetSessionByRefreshToken, dbRotateAccessToken, dbCreateAuthSession } from "@/server/db-users";

const ACCESS_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;       // 24 hours
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;  // 7 days

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token.trim();
}

export function extractCookieToken(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }

  for (const cookie of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = cookie.trim().split("=");
    if (rawName === "origin_access_token") {
      const value = rawValue.join("=");
      return value ? decodeURIComponent(value) : null;
    }
  }

  return null;
}

export function extractRefreshTokenCookie(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  for (const cookie of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = cookie.trim().split("=");
    if (rawName === "origin_refresh_token") {
      const value = rawValue.join("=");
      return value ? decodeURIComponent(value) : null;
    }
  }

  return null;
}


function isTokenExpired(expiresAt: string | undefined): boolean {
  if (!expiresAt) return true; // sessions from before expiry was added are treated as expired
  return new Date(expiresAt) <= new Date();
}

export function findUserByAccessToken(store: AppStore, accessToken: string | null): StoredUser | null {
  if (!accessToken) {
    return null;
  }
  const session = store.authSessions.find((entry) => entry.accessToken === accessToken);
  if (!session || isTokenExpired(session.accessTokenExpiresAt)) {
    return null;
  }
  return store.users.find((user) => user.id === session.userId) ?? null;
}

export function isRefreshTokenValid(store: AppStore, refreshToken: string): StoredAuthSession | null {
  const session = store.authSessions.find((entry) => entry.refreshToken === refreshToken);
  if (!session || isTokenExpired(session.refreshTokenExpiresAt)) {
    return null;
  }
  return session;
}

export function requireUserFromRequest(store: AppStore, request: Request): StoredUser | null {
  const token = extractBearerToken(request) ?? extractCookieToken(request);
  return findUserByAccessToken(store, token);
}

export function createAuthSession(store: AppStore, userId: string): StoredAuthSession {
  const now = Date.now();
  const session: StoredAuthSession = {
    accessToken: createId("access"),
    refreshToken: createId("refresh"),
    userId,
    createdAt: new Date(now).toISOString(),
    accessTokenExpiresAt: new Date(now + ACCESS_TOKEN_TTL_MS).toISOString(),
    refreshTokenExpiresAt: new Date(now + REFRESH_TOKEN_TTL_MS).toISOString(),
  };

  store.authSessions = store.authSessions.filter((entry) => entry.userId !== userId);
  store.authSessions.push(session);
  return session;
}

export function rotateAccessToken(session: StoredAuthSession): void {
  const now = Date.now();
  session.accessToken = createId("access");
  session.accessTokenExpiresAt = new Date(now + ACCESS_TOKEN_TTL_MS).toISOString();
}

export function clearUserSessions(store: AppStore, userId: string): void {
  store.authSessions = store.authSessions.filter((entry) => entry.userId !== userId);
}

// ─── Async DB-first helpers (used when USER_DATABASE_URL is configured) ────────

/**
 * Resolves a Bearer token to a user, preferring the mirrored Postgres session
 * and falling back to Postgres only when the local mirror is stale/missing.
 * Use this in async handlers instead of requireUserFromRequest.
 */
export async function resolveTokenToUser(request: Request): Promise<StoredUser | null> {
  const token = extractBearerToken(request) ?? extractCookieToken(request);
  if (!token) return null;

  if (isUserPostgresConfigured()) {
    try {
      const dbUser = await dbFindUserByAccessToken(token);
      if (dbUser) return dbUser;
    } catch (err) {
      console.error('[auth] DB token check failed, falling back to in-memory seed', err instanceof Error ? err.message : err);
    }
  }

  // Flat-file fallback
  return null;
}

/**
 * DB-aware refresh: rotates token in Postgres if configured, else falls back to in-memory seed.
 * Returns { accessToken, refreshToken } or null if the refresh token is invalid/expired.
 */
export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
  if (isUserPostgresConfigured()) {
    try {
  const updated = await dbRotateAccessToken(refreshToken);
      if (updated) {
        return { accessToken: updated.accessToken, refreshToken: updated.refreshToken };
      }
    } catch (err) {
      console.error('[auth] DB token rotation failed, falling back to in-memory seed', err instanceof Error ? err.message : err);
    }
  }

  // Flat-file fallback
  const store = await readStoreAsync();
  const session = isRefreshTokenValid(store, refreshToken);
  if (!session) return null;
  rotateAccessToken(session);
  return { accessToken: session.accessToken, refreshToken: session.refreshToken };
}

/**
 * DB-aware session creation: writes to Postgres when configured, always writes to in-memory seed.
 */
export async function createAuthSessionAsync(store: AppStore, userId: string): Promise<StoredAuthSession> {
  if (isUserPostgresConfigured()) {
    try {
      const session = await dbCreateAuthSession(userId);
      store.authSessions = store.authSessions.filter((s) => s.userId !== userId);
      store.authSessions.push(session);
      return session;
    } catch (err) {
      console.error('[auth] DB session creation failed, falling back to in-memory seed', err instanceof Error ? err.message : err);
    }
  }
  return createAuthSession(store, userId);
}
