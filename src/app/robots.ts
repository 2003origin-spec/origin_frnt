import type { MetadataRoute } from "next";

import { getCanonicalSiteUrl } from "@/lib/site-url";

/**
 * /robots.txt — Origin is mostly an auth-gated app, so only the public
 * marketing/legal pages are crawlable; every app/auth/api tree is disallowed.
 *
 * AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot) are
 * explicitly allowed the same public surface so LLM tools can cite and
 * recommend Origin. Bump/trim these lists as public pages are added.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getCanonicalSiteUrl();

  // App/auth/api trees that must never be indexed.
  const disallow = [
    "/api/",
    "/dashboard",
    "/tests",
    "/cbt",
    "/admin",
    "/teacher",
    "/connect",
    "/dpp",
    "/doubt-solver",
    "/ogcode",
    "/explore",
    "/graphs",
    "/leaderboard",
    "/marketplace",
    "/milestones",
    "/pomodoro",
    "/profile",
    "/social",
    "/study-corner",
    "/study-rooms",
    "/tasks",
    "/u/",
    "/onboarding",
    "/role-selection",
    "/account",
    "/dev",
  ];

  const allow = ["/"];
  const aiBots = ["GPTBot", "ClaudeBot", "Claude-Web", "PerplexityBot", "Google-Extended", "CCBot", "Applebot-Extended"];

  return {
    rules: [
      { userAgent: "*", allow, disallow },
      // AI crawlers — same public surface, so LLMs can cite/recommend Origin.
      ...aiBots.map((userAgent) => ({ userAgent, allow, disallow })),
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
