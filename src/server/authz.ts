import { forbidden, serviceUnavailable, unauthorized } from "@/server/http";
import { AuthServiceUnavailableError, isAuthServiceUnavailableError } from "@/server/auth-errors";
import { dbFindUserById } from "@/server/db-users";
import { isUserPostgresConfigured } from "@/server/user-postgres";
import { readStoreAsync, type StoredUser } from "@/server/store";
import { verifyRequestAccessJwt, type AccessJwtClaims } from "@/server/auth-jwt";
import {
  requireRoomMembership as requireStoredRoomMembership,
  type ParticipantRole,
} from "@/server/study-rooms";
import { isBearerTokenAuthorized, type ServiceTokenName } from "@/server/service-auth";

export type AuthContext = {
  userId: string;
  sessionId: string;
  role: StoredUser["role"];
  tokenVersion: number;
  jwtId: string;
  claims: AccessJwtClaims;
};

export class AuthzError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function authzErrorResponse(error: unknown): Response {
  if (error instanceof AuthzError) {
    return error.status === 401 ? unauthorized(error.message) : forbidden(error.message);
  }
  // A DB hiccup while re-checking the principal is an outage, not a denial.
  if (isAuthServiceUnavailableError(error)) {
    return serviceUnavailable(error.message);
  }
  return forbidden();
}

export async function getAuthContext(request: Request): Promise<AuthContext | null> {
  try {
    const claims = await verifyRequestAccessJwt(request);
    return {
      userId: claims.sub,
      sessionId: claims.sid,
      role: claims.role,
      tokenVersion: claims.tokenVersion,
      jwtId: claims.jti,
      claims,
    };
  } catch {
    return null;
  }
}

export async function requireAuth(request: Request): Promise<AuthContext> {
  const context = await getAuthContext(request);
  if (!context) {
    throw new AuthzError(401, "Authentication credentials were not provided.");
  }
  return context;
}

/** Roles whose API routes re-check the user row on every request. Shared with
 * the workspace layer (`src/server/workspaces/authz.ts`) so `/api/teacher/**`
 * applies the same rule as `requireRole`. */
export const FRESHNESS_CHECKED_ROLES: ReadonlySet<StoredUser["role"]> = new Set(["admin", "teacher"]);

const STALE_SESSION_MESSAGE = "Session is no longer valid. Please sign in again.";

export type FreshPrincipalLookup = (userId: string) => Promise<StoredUser | null>;

async function lookupPrincipal(userId: string): Promise<StoredUser | null> {
  if (isUserPostgresConfigured()) {
    return dbFindUserById(userId);
  }
  const store = await readStoreAsync();
  return store.users.find((entry) => entry.id === userId) ?? null;
}

/**
 * One PK lookup that closes the "JWT outlives the revoke" window for
 * privileged callers: the row must still exist, be active, carry the same
 * `auth_token_version` the token was minted with, and still hold the role the
 * token claims. Any mismatch is a 401 (sign in again); a lookup failure is a
 * 503 (`AuthServiceUnavailableError`), never a silent pass.
 *
 * Deliberately NOT applied to plain `requireAuth` — the student hot path stays
 * JWT-only (≤ 60 min staleness accepted; a Redis denylist is the follow-up if
 * that ever becomes unacceptable).
 */
export async function assertFreshPrincipal(
  context: Pick<AuthContext, "userId" | "role" | "tokenVersion">,
  lookup: FreshPrincipalLookup = lookupPrincipal,
): Promise<void> {
  let user: StoredUser | null;
  try {
    user = await lookup(context.userId);
  } catch (error) {
    console.error("[authz] principal freshness lookup failed", error instanceof Error ? error.message : error);
    throw new AuthServiceUnavailableError();
  }
  if (
    !user ||
    (user.accountStatus ?? "active") !== "active" ||
    (user.authTokenVersion ?? 0) !== context.tokenVersion ||
    user.role !== context.role
  ) {
    throw new AuthzError(401, STALE_SESSION_MESSAGE);
  }
}

export async function requireRole(request: Request, roles: StoredUser["role"][]): Promise<AuthContext> {
  const context = await requireAuth(request);
  if (!roles.includes(context.role)) {
    throw new AuthzError(403, "You do not have permission to perform this action.");
  }
  if (roles.some((role) => FRESHNESS_CHECKED_ROLES.has(role))) {
    await assertFreshPrincipal(context);
  }
  return context;
}

export async function requireAdmin(request: Request): Promise<AuthContext> {
  return requireRole(request, ["admin"]);
}

export async function requireInternal(request: Request, tokenName: ServiceTokenName = "INTERNAL_CRON_TOKEN"): Promise<void> {
  if (!isBearerTokenAuthorized(request, tokenName)) {
    throw new AuthzError(401, "Invalid internal service token.");
  }
}

/**
 * Authorises a scheduled invocation.
 *
 * Vercel Cron signs its own requests with `Authorization: Bearer $CRON_SECRET`,
 * which is a different project secret from the INTERNAL_CRON_TOKEN our manual
 * drains use. Accepting either means a cron entry works without the two values
 * having to be kept identical, and a hand-triggered drain keeps working exactly
 * as before. Both are compared in constant time.
 */
export async function requireCronCaller(request: Request): Promise<void> {
  if (isBearerTokenAuthorized(request, "INTERNAL_CRON_TOKEN")) return;
  if (isBearerTokenAuthorized(request, "CRON_SECRET")) return;
  throw new AuthzError(401, "Invalid internal service token.");
}

export async function getAuthenticatedUser(request: Request): Promise<StoredUser | null> {
  const context = await getAuthContext(request);
  if (!context) {
    return null;
  }

  if (isUserPostgresConfigured()) {
    try {
      const user = await dbFindUserById(context.userId);
      if (!user) {
        return null;
      }
      if ((user.authTokenVersion ?? 0) !== context.tokenVersion) {
        return null;
      }
      // Revoked/deleted accounts hydrate to "signed out" (admin/teacher pages
      // redirect to /auth), even if the token-version bump has not landed yet.
      if ((user.accountStatus ?? "active") !== "active") {
        return null;
      }
      return user;
    } catch (error) {
      console.error("[authz] DB user hydration failed", error);
      throw new AuthServiceUnavailableError();
    }
  }

  const store = await readStoreAsync();
  const user = store.users.find((entry) => entry.id === context.userId) ?? null;
  if (
    user &&
    (user.authTokenVersion ?? 0) === context.tokenVersion &&
    (user.accountStatus ?? "active") === "active"
  ) {
    return user;
  }
  return null;
}

export async function requireAuthenticatedUser(request: Request): Promise<StoredUser> {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    throw new AuthzError(401, "Authentication credentials were not provided.");
  }
  return user;
}

export async function requireRoomMembership(
  request: Request,
  roomId: string,
  role?: ParticipantRole,
): Promise<AuthContext> {
  const context = await requireAuth(request);
  const participant = await requireStoredRoomMembership(roomId, context.userId);
  if (role && participant.role !== role) {
    throw new AuthzError(403, "You do not have permission to perform this action.");
  }
  return context;
}
