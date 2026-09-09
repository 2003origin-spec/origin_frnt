/**
 * Absolute URL helpers for email.
 *
 * Mail clients have no page origin to resolve against, so every href and every
 * image `src` in an email must be fully qualified. These helpers are the single
 * place that decision is made.
 *
 * Images are served from `public/email/` under the site origin rather than from
 * R2: they are versioned with the deploy, need no credentials at render time,
 * and cannot drift out of sync with the template that references them.
 */

const DEFAULT_SITE_URL = "https://www.o3origin.com";

function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** The public site origin, without a trailing slash. */
export function siteUrl(): string {
  const configured = trimmed(process.env.NEXT_PUBLIC_SITE_URL);
  return (configured || DEFAULT_SITE_URL).replace(/\/$/u, "");
}

/**
 * Resolve a link for use in an email. Absolute URLs pass through; anything else
 * is treated as an app-relative path and anchored to the site origin.
 */
export function absoluteHref(value: string | null | undefined, fallback = "/premium"): string {
  const candidate = trimmed(value) || fallback;
  if (/^https?:\/\//iu.test(candidate)) return candidate;
  return `${siteUrl()}${candidate.startsWith("/") ? candidate : `/${candidate}`}`;
}

/** Absolute URL for a file in `public/email/`. */
export function assetUrl(file: string): string {
  return `${siteUrl()}/email/${file.replace(/^\/+/u, "")}`;
}

/** Where "Contact our support team" points. */
export function supportHref(): string {
  const configured = trimmed(process.env.EMAIL_SUPPORT_URL);
  return configured || `${siteUrl()}/support`;
}

/** Social links rendered in the footer. Any left unset is simply omitted. */
export function socialLinks(): { label: string; href: string }[] {
  const entries: { label: string; env: string; fallback: string }[] = [
    { label: "Instagram", env: "EMAIL_SOCIAL_INSTAGRAM", fallback: "https://www.instagram.com/o3origin" },
    { label: "X", env: "EMAIL_SOCIAL_X", fallback: "https://x.com/o3origin" },
    { label: "LinkedIn", env: "EMAIL_SOCIAL_LINKEDIN", fallback: "https://www.linkedin.com/company/o3origin" },
    { label: "YouTube", env: "EMAIL_SOCIAL_YOUTUBE", fallback: "https://www.youtube.com/@o3origin" },
  ];
  return entries.map((e) => ({ label: e.label, href: trimmed(process.env[e.env]) || e.fallback }));
}
