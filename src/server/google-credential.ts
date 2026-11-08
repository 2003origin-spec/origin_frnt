import { OAuth2Client } from "google-auth-library";

/**
 * Google sign-in credential verification.
 *
 * Two credential shapes reach the server:
 *   - an ID token (JWT) from the Android shell's Credential Manager flow,
 *     minted with serverClientId = the web client id;
 *   - an access token (`ya29.*`) from the web's @react-oauth implicit flow.
 *
 * Both MUST be proven to have been issued to one of OUR OAuth clients
 * before the email they carry is trusted. An access token for any other
 * app that the victim granted `email` scope to is otherwise a full login
 * as that victim, so the access-token path goes through `tokeninfo`
 * (which reports `aud` / `azp`) and never straight to `userinfo`.
 *
 * Shape routing is strict: a JWT is only ever treated as an ID token and a
 * non-JWT only ever as an access token. A rejected ID token is NOT retried
 * as an access token.
 */

export type GoogleIdentity = { email: string; name: string; avatar: string | null };

const PLACEHOLDER_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID";
const GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const GOOGLE_TIMEOUT_MS = 8000;

export type GoogleAuthEnv = Record<string, string | undefined>;

export function googleAllowedAudiences(env: GoogleAuthEnv = process.env): string[] {
  const web = env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
  // Belt-and-braces audience for tokens minted against the Android OAuth
  // client directly (ANDROID_HYBRID_APP_PLAN.md §5.3); the shell normally
  // mints with serverClientId = web id so `aud` already equals the web id.
  const android = env.GOOGLE_ANDROID_CLIENT_ID?.trim();
  return [web, android].filter(
    (value): value is string => Boolean(value) && value !== PLACEHOLDER_CLIENT_ID,
  );
}

type TokenInfo = Record<string, string | undefined>;

export type ResolveGoogleCredentialDeps = {
  fetch?: typeof fetch;
  verifyIdToken?: (idToken: string, audiences: string[]) => Promise<TokenInfo | null>;
  env?: GoogleAuthEnv;
};

async function defaultVerifyIdToken(idToken: string, audiences: string[]): Promise<TokenInfo | null> {
  const ticket = await new OAuth2Client(audiences[0]).verifyIdToken({ idToken, audience: audiences });
  const payload = ticket.getPayload();
  if (!payload) return null;
  return {
    email: payload.email,
    email_verified: payload.email_verified ? "true" : "false",
    name: payload.name,
    picture: payload.picture,
  };
}

function looksLikeJwt(credential: string): boolean {
  return credential.split(".").length === 3;
}

export async function resolveGoogleCredential(
  credential: string,
  deps: ResolveGoogleCredentialDeps = {},
): Promise<GoogleIdentity | null> {
  const audiences = googleAllowedAudiences(deps.env ?? process.env);
  if (audiences.length === 0) {
    console.error("[GoogleAuth] No Google client id configured; refusing all Google credentials.");
    return null;
  }
  const doFetch = deps.fetch ?? fetch;

  if (looksLikeJwt(credential)) {
    try {
      const payload = await (deps.verifyIdToken ?? defaultVerifyIdToken)(credential, audiences);
      if (!payload?.email || payload.email_verified !== "true") return null;
      return { email: payload.email, name: payload.name ?? "Google User", avatar: payload.picture ?? null };
    } catch (e) {
      console.warn("[GoogleAuth] ID token rejected", e);
      return null;
    }
  }

  // Access token: prove it was minted for OUR client before trusting its email.
  try {
    const info = await doFetch(
      `${GOOGLE_TOKENINFO_URL}?access_token=${encodeURIComponent(credential)}`,
      { signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS) },
    );
    if (!info.ok) return null;
    const token = (await info.json()) as TokenInfo;
    const audOk = audiences.includes(token.aud ?? "") || audiences.includes(token.azp ?? "");
    const notExpired = Number(token.expires_in ?? "0") > 0;
    if (!audOk || !notExpired || token.email_verified !== "true" || !token.email) {
      console.warn("[GoogleAuth] access token rejected", {
        aud: token.aud,
        azp: token.azp,
        expires_in: token.expires_in,
        email_verified: token.email_verified,
      });
      return null;
    }

    // Profile (name / avatar) only AFTER the audience check. It is cosmetic,
    // so a failure here does not block the login.
    let profile: TokenInfo = {};
    try {
      const res = await doFetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${credential}` },
        signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
      });
      if (res.ok) profile = (await res.json()) as TokenInfo;
    } catch (e) {
      console.warn("[GoogleAuth] userinfo lookup failed; continuing without profile", e);
    }
    return { email: token.email, name: profile.name ?? "Google User", avatar: profile.picture ?? null };
  } catch (e) {
    console.error("[GoogleAuth] tokeninfo verification failed:", e);
    return null;
  }
}
