import type { MetadataRoute } from "next";

import { getCanonicalSiteUrl } from "@/lib/site-url";

/**
 * /robots.txt — Origin is mostly an auth-gated app, so only the public
 * marketing/legal pages are crawlable; every app/auth/api tree is disallowed.
 *
 * AI crawlers and assistant fetchers get the same public surface, by name, so
 * AI search and assistants can read, cite and recommend Origin's public pages
 * (Rank Predictor, college finder, llms.txt). Names checked against each
 * vendor's own crawler page on 11/11/2026 — check again before adding one:
 *  - OpenAI: OAI-SearchBot (ChatGPT search), ChatGPT-User (user asks), GPTBot (training)
 *  - Anthropic: Claude-SearchBot (search), Claude-User (user asks), ClaudeBot (training)
 *  - Perplexity: PerplexityBot (search), Perplexity-User (user asks)
 *  - Google: Google-Extended (Gemini / grounding token; Search itself is Googlebot under "*")
 *  - Apple: Applebot (Siri/Spotlight/Safari), Applebot-Extended (training token)
 *  - Meta: meta-webindexer (Meta AI search), meta-externalagent (training/indexing)
 *  - DuckDuckGo: DuckAssistBot (AI answers). Mistral: MistralAI-Index, MistralAI-User
 *  - Common Crawl: CCBot. Microsoft Copilot uses Bingbot, which "*" covers.
 * Bump/trim these lists as public pages are added.
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
    // /rank-predictor, its exam pages and /rank-predictor/colleges are public
    // pages (the college finder shows bots and visitors its logged-out page).
  ];

  const allow = ["/"];
  const aiBots = [
    "OAI-SearchBot",
    "ChatGPT-User",
    "GPTBot",
    "Claude-SearchBot",
    "Claude-User",
    "ClaudeBot",
    "PerplexityBot",
    "Perplexity-User",
    "Google-Extended",
    "Applebot",
    "Applebot-Extended",
    "meta-webindexer",
    "meta-externalagent",
    "DuckAssistBot",
    "MistralAI-Index",
    "MistralAI-User",
    "CCBot",
  ];

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
