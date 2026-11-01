/**
 * Server-side auth helpers for React Server Components and Server Actions.
 *
 * Access cookies now contain short-lived JWTs. This module verifies the JWT,
 * then hydrates the user from Postgres or the local seed store only when page
 * rendering actually needs profile data.
 */

import { unstable_cache } from "next/cache";
import { cookies, headers } from "next/headers";
import { cache } from "react";

import { ACCESS_FINGERPRINT_HEADER } from "@/server/auth-jwt";
import { getAuthenticatedUser } from "@/server/authz";
import { withEntitledSubjects } from "@/server/entitlements";
import { readStoreAsync } from "@/server/store";
import { serializeUser } from "@/server/users";
import type { StoredUser } from "@/server/store";
import type { User } from "@/types";

/**
 * Rebuild the caller's credentials as a Request for getAuthenticatedUser.
 * Browsers authenticate with cookies. The native app's REST endpoints
 * (`/api/mobile/*`, V1/NATIVE_APP_API_PLAN.md §3) call the same action code
 * from a route handler, where the credentials are `Authorization: Bearer` plus
 * the fingerprint header, so those are forwarded too. Browsers never send
 * either header, and the fingerprint header only counts alongside a bearer token.
 */
async function credentialRequest(): Promise<Request> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${encodeURIComponent(cookie.value)}`)
    .join("; ");
  return buildCredentialRequest(cookieHeader, await headers());
}

/** Pure part of credentialRequest, exported for tests. */
export function buildCredentialRequest(cookieHeader: string, incoming: Pick<Headers, "get">): Request {
  const forwarded: Record<string, string> = {};
  if (cookieHeader) forwarded.cookie = cookieHeader;
  const authorization = incoming.get("authorization");
  if (authorization) {
    forwarded.authorization = authorization;
    const fingerprint = incoming.get(ACCESS_FINGERPRINT_HEADER);
    if (fingerprint) forwarded[ACCESS_FINGERPRINT_HEADER] = fingerprint;
  }
  return new Request("http://origin.local", { headers: forwarded });
}

export const getServerUser = cache(async function getServerUser(): Promise<StoredUser | null> {
  return getAuthenticatedUser(await credentialRequest());
});

// Cache the expensive store-read + entitlement computation per userId.
// JWT verification still runs on every request (getServerUser above) — only
// the store hydration + serialization is skipped on cache hits.
const getCachedFrontendUser = unstable_cache(
  async (userId: string): Promise<User | null> => {
    const store = await readStoreAsync();
    const payload = serializeUser(store, userId);
    if (!payload) return null;
    const enriched = await withEntitledSubjects(payload, userId);
    return (enriched as unknown as User) ?? null;
  },
  ["auth:frontend-user"],
  { revalidate: 10, tags: ["user-profile"] },
);

/**
 * Resolves the current request to a frontend-shape `User` suitable for
 * seeding `AuthProvider` in the root layout. Returns `null` when the user
 * is not authenticated.
 */
export async function getServerFrontendUser(): Promise<User | null> {
  const stored = await getServerUser();
  if (!stored) return null;
  return getCachedFrontendUser(stored.id);
}
