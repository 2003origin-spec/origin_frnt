import { parseAppVersionFromUserAgent } from "@/native/is-native-app";

/**
 * Which client a session was minted for. This is what splits the two refresh
 * lifetimes (AUTH_TOKEN_LIFETIME_PLAN.md §3.3):
 *
 *   web     → 7-day sliding refresh
 *   android → refresh lives until the user explicitly signs out
 *
 * The kind is decided ONCE, at session creation, from the User-Agent, and then
 * persisted on `origin_auth_sessions.client_kind`. Every later read — refresh
 * rotation, cookie re-issue — takes it from the stored row, never from a
 * re-sniffed User-Agent, so a session's lifetime cannot be lengthened or
 * shortened after the fact by changing headers mid-session.
 *
 * SECURITY NOTE (plan §4, decision A): `OriginApp/{versionCode}` is
 * client-controlled, so anyone can ask for the android lifetime. The blast
 * radius is bounded — the refresh cookie is HttpOnly + SameSite=Strict and
 * scoped to a single session, so spoofing only lengthens the caller's OWN
 * session and grants no access to anyone else's account. The accepted cost is
 * that a token stolen from a spoofed session stays valid until it is revoked
 * rather than for at most 7 days. That is why password-reset revocation and the
 * dormant-session sweep are mandatory companions to this feature, not optional
 * hardening.
 */
export type AuthClientKind = "web" | "android";

export const AUTH_CLIENT_KINDS: readonly AuthClientKind[] = ["web", "android"] as const;

export const DEFAULT_AUTH_CLIENT_KIND: AuthClientKind = "web";

/** Coerce an untrusted value (DB column, JSON body) to a known kind. */
export function normalizeAuthClientKind(value: unknown): AuthClientKind {
  return value === "android" ? "android" : DEFAULT_AUTH_CLIENT_KIND;
}

/**
 * Resolve the client kind for a NEW session from the request User-Agent. The
 * Android shell appends `OriginApp/{versionCode}` to the WebView UA; everything
 * else — including the external browser a link-out handoff lands in — is web.
 */
export function resolveAuthClientKind(userAgent: string | null | undefined): AuthClientKind {
  return parseAppVersionFromUserAgent(userAgent) === null ? "web" : "android";
}
