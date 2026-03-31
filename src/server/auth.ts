import type { AppStore, StoredAuthSession, StoredUser } from "@/server/store";
import { createId } from "@/server/store";

function extractBearerToken(request: Request): string | null {
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

export function findUserByAccessToken(store: AppStore, accessToken: string | null): StoredUser | null {
  if (!accessToken) {
    return null;
  }
  const session = store.authSessions.find((entry) => entry.accessToken === accessToken);
  if (!session) {
    return null;
  }
  return store.users.find((user) => user.id === session.userId) ?? null;
}

export function requireUserFromRequest(store: AppStore, request: Request): StoredUser | null {
  return findUserByAccessToken(store, extractBearerToken(request));
}

export function createAuthSession(store: AppStore, userId: string): StoredAuthSession {
  const session: StoredAuthSession = {
    accessToken: createId("access"),
    refreshToken: createId("refresh"),
    userId,
    createdAt: new Date().toISOString(),
  };

  store.authSessions = store.authSessions.filter((entry) => entry.userId !== userId);
  store.authSessions.push(session);
  return session;
}

export function clearUserSessions(store: AppStore, userId: string): void {
  store.authSessions = store.authSessions.filter((entry) => entry.userId !== userId);
}
