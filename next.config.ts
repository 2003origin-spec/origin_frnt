import type { NextConfig } from "next";

const r2PublicHostname = process.env.NEXT_PUBLIC_R2_PUBLIC_HOSTNAME?.trim();

const nextConfig: NextConfig = {
  // DEV ONLY, no production effect. Next 16 blocks /_next/* requests from any
  // origin other than localhost, so opening the dev server from a phone on the
  // LAN loads the SSR shell and then refuses every client chunk — the page
  // header paints and nothing below it hydrates. Testing on real hardware is
  // worth more than the risk here; the dev server is not exposed beyond the LAN.
  allowedDevOrigins: [
    // Whoever is testing sets DEV_LAN_ORIGIN in their own .env.local (their
    // machine's LAN IP or hostname). Hard-coding one developer's DHCP address
    // in a file that syncs to two remotes helps exactly one person and rots.
    ...(process.env.DEV_LAN_ORIGIN ? [process.env.DEV_LAN_ORIGIN] : []),
    '*.local',
  ],

  // DEV ONLY. The Next dev indicator is a fixed bottom-left button; on a phone
  // it sits on top of the "Home" tab of the bottom nav and eats the tap. Compile
  // status is already in the terminal.
  devIndicators: false,

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
      // Powerful features the app DOES use must be allowed for same-origin
      // (`self`), or the browser blocks the Web API outright — before any
      // native/OS permission prompt, in mobile web AND the Android WebView.
      //   - camera  → CBT proctoring snapshots + profile PhotoBooth
      //               (navigator.mediaDevices.getUserMedia). An empty
      //               allowlist `camera=()` silently killed both everywhere;
      //               `camera=(self)` re-enables them same-origin only.
      //   - microphone → Ori AI voice (kept explicit for the same reason).
      // payment (Razorpay) stays on its permissive default. geolocation and
      // browsing-topics remain fully disabled — the app never uses them.
      { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(), browsing-topics=()' },
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
