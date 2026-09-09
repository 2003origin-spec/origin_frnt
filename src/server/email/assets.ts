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
  if (/^(?:https?:\/\/|mailto:|tel:)/iu.test(candidate)) return candidate;
  return `${siteUrl()}${candidate.startsWith("/") ? candidate : `/${candidate}`}`;
}

/** Absolute URL for a file in `public/email/`. */
export function assetUrl(file: string): string {
  return `${siteUrl()}/email/${file.replace(/^\/+/u, "")}`;
}

/**
 * Where "Contact our support team" points. There is no /support route, so the
 * default is a mailto to the address the app already sends from — a real,
 * working destination rather than a 404. Override with EMAIL_SUPPORT_URL.
 */
export function supportHref(): string {
  const configured = trimmed(process.env.EMAIL_SUPPORT_URL);
  return configured || "mailto:adminoffice@o3origin.com";
}

/**
 * Social links for the footer, matching the "Connect With Us" row in
 * `src/sections/LandingPage.tsx` (WhatsApp first) and the JSON-LD `sameAs` in
 * `src/app/layout.tsx`, both of which use the same LinkedIn company page.
 * There is no YouTube or Facebook account — do not add
 * placeholders here; a dead social link in a transactional email is worse than
 * one fewer icon.
 */
export function socialLinks(): { label: string; href: string }[] {
  const entries: { label: string; env: string; fallback: string }[] = [
    { label: "WhatsApp", env: "EMAIL_SOCIAL_WHATSAPP", fallback: "https://chat.whatsapp.com/BBwpKNeiCypGzeVMwsw9ns?mode=gi_t" },
    { label: "LinkedIn", env: "EMAIL_SOCIAL_LINKEDIN", fallback: "https://www.linkedin.com/company/o3-origin/" },
    { label: "X", env: "EMAIL_SOCIAL_X", fallback: "https://x.com/O3_origin" },
    { label: "Instagram", env: "EMAIL_SOCIAL_INSTAGRAM", fallback: "https://www.instagram.com/o3.origin/?hl=en" },
  ];
  return entries.map((e) => ({ label: e.label, href: trimmed(process.env[e.env]) || e.fallback }));
}

/**
 * Utility links above the social row: the site itself plus the pages a
 * recipient of a payment mail may actually need. Every path is a real route
 * under `src/app/`.
 */
export function footerLinks(): { label: string; href: string }[] {
  return [
    { label: "Website", href: siteUrl() },
    { label: "FAQ", href: `${siteUrl()}/faq` },
    { label: "Refund Policy", href: `${siteUrl()}/refund-policy` },
    { label: "Terms", href: `${siteUrl()}/terms-and-conditions` },
  ];
}
