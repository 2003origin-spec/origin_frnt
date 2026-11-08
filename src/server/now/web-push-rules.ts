/**
 * Web Push for solver offers (decision B85) — the pure parts: which push
 * endpoints the server may call, and the VAPID key format. No I/O here.
 */

/**
 * Hosts of the browser push services (Chrome/Edge via FCM, Firefox, Safari,
 * Windows). The server only ever POSTs to these, so a subscription can never
 * make it call an arbitrary URL.
 */
const EXACT_HOSTS = new Set([
  "fcm.googleapis.com",
  "android.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.services.mozilla.com",
  "web.push.apple.com",
]);
const HOST_SUFFIXES = [".push.apple.com", ".notify.windows.com"];

export const MAX_ENDPOINT_LENGTH = 1000;

/** True when the endpoint is an https URL on a known push service. */
export function isAllowedPushEndpoint(endpoint: string): boolean {
  if (typeof endpoint !== "string" || endpoint.length > MAX_ENDPOINT_LENGTH) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port !== "" || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  return EXACT_HOSTS.has(host) || HOST_SUFFIXES.some((suffix) => host.endsWith(suffix) && host.length > suffix.length);
}

/** The "aud" claim of a VAPID token: the endpoint's origin. */
export function vapidAudience(endpoint: string): string {
  return new URL(endpoint).origin;
}

function fromBase64Url(text: string): Uint8Array {
  return new Uint8Array(Buffer.from(text, "base64url"));
}

/**
 * A VAPID key pair as P-256 JWK. The public key is the 65-byte uncompressed
 * point (0x04 || x || y), the private key the 32-byte scalar, both base64url —
 * the format every web-push tool prints. Null when either is malformed.
 */
export function vapidJwk(publicKey: string, privateKey: string): { kty: "EC"; crv: "P-256"; x: string; y: string; d: string } | null {
  const pub = fromBase64Url(publicKey.trim());
  const priv = fromBase64Url(privateKey.trim());
  if (pub.length !== 65 || pub[0] !== 0x04 || priv.length !== 32) return null;
  const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");
  return { kty: "EC", crv: "P-256", x: b64(pub.slice(1, 33)), y: b64(pub.slice(33, 65)), d: b64(priv) };
}

/** Push service replies that mean the subscription is gone for good. */
export function isGoneStatus(status: number): boolean {
  return status === 404 || status === 410;
}
