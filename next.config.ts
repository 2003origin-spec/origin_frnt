import type { NextConfig } from "next";

const r2PublicHostname = process.env.NEXT_PUBLIC_R2_PUBLIC_HOSTNAME?.trim();

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  poweredByHeader: false,
  compress: true,
  // Cookie-backed protected pages still use request-time auth helpers.
  // Keep Cache Components off until those routes are fully migrated behind
  // compliant Suspense/private-cache boundaries; otherwise production can 500
  // with DYNAMIC_SERVER_USAGE on authenticated page loads.
  cacheComponents: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "origin-ai.vercel.app" },
      ...(r2PublicHostname ? [{ protocol: "https" as const, hostname: r2PublicHostname }] : []),
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  async headers() {
    // Baseline security headers applied to every response. Deliberately NOT a
    // full script/style CSP — Spline, GSAP, Google OAuth and inline styles make
    // a strict `script-src` a real regression risk without staging tests, so a
    // report-only script CSP is tracked as post-launch follow-up. The CSP here
    // only constrains framing / <base> / <object>, which is zero-risk.
    const securityHeaders = [
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
      // Force HTTPS for a year incl. subdomains. All o3origin.com surfaces are
      // HTTPS on Vercel; drop `includeSubDomains` if a plain-HTTP subdomain is
      // ever introduced. `preload` intentionally omitted (irreversible).
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      // Disable powerful features the app never uses. microphone (Ori voice)
      // and payment (Razorpay) are intentionally left on their permissive
      // defaults so those flows keep working.
      { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), browsing-topics=()' },
      // Anti-clickjacking + anti-base-injection. No script/style/connect
      // directives, so it cannot break app functionality.
      { key: 'Content-Security-Policy', value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'" },
    ];
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
