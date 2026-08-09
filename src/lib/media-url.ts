/**
 * Normalise a stored media URL so it renders in an <img src>.
 *
 * The document-import worker can persist a scheme-less R2 URL
 * ("pub-xxx.r2.dev/imports/…/q_0.png") when its R2_PUBLIC_BASE_URL env lacks a
 * scheme. A browser treats such a value as a *relative* path, so the image 404s
 * against the app origin. This prefixes "https://" for a bare host value while
 * leaving every already-usable form untouched:
 *   - absolute       http(s)://…            → as-is
 *   - protocol-rel   //host/…               → as-is (browser adds the scheme)
 *   - inline/object  data:… / blob:…        → as-is
 *   - app-relative   /path                  → as-is (served by Next.js)
 * Only a bare "host/…" (no scheme, no leading slash) is rewritten.
 */
export function toAbsoluteMediaUrl<T extends string | null | undefined>(url: T): T {
  if (!url) return url;
  const value = url.trim();
  if (!value) return url;
  if (/^(https?:)?\/\//i.test(value)) return url; // http(s):// or //host
  if (value.startsWith("data:") || value.startsWith("blob:")) return url;
  if (value.startsWith("/")) return url; // app-relative
  return `https://${value}` as T;
}
