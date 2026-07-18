/**
 * Native Google Sign-In (plan §7.4 / ledger #13).
 *
 * Google blocks OAuth inside embedded WebViews (`disallowed_useragent`), so
 * in-app the popup flow from @react-oauth/google can never work. The shell
 * runs Android Credential Manager natively and returns a Google **ID token**
 * minted with serverClientId = NEXT_PUBLIC_GOOGLE_CLIENT_ID, i.e. its `aud`
 * matches what `handleGoogleLogin`'s verifyIdToken already accepts — the
 * token is then submitted through the exact same `googleLogin()` client path
 * as the web flow.
 *
 * Resolves null when unavailable (browser, old shell) or when the user
 * cancels — callers fall back to showing the standard error/other methods.
 */

import { getOriginNative, hasNativeCapability } from "@/native/bridge";

export async function isNativeGoogleSignInAvailable(): Promise<boolean> {
  return hasNativeCapability("googleSignIn");
}

export async function nativeGoogleSignIn(): Promise<string | null> {
  if (!(await hasNativeCapability("googleSignIn"))) return null;
  try {
    const result = await getOriginNative()?.googleSignIn();
    return result?.idToken ?? null;
  } catch {
    return null;
  }
}
