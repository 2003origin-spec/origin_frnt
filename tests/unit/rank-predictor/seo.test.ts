/**
 * Search pages for the Rank Predictor and college finder (SEO_APP_DOWNLOAD_NOTES.md):
 * exam pages are public and self-contained, FAQ JSON-LD matches the visible FAQ
 * list, no ratings, robots lets search and AI crawlers read the public pages.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import robots from "@/app/robots";
import {
  breadcrumbJsonLd,
  COLLEGE_FINDER_DESCRIPTION,
  COLLEGE_FINDER_FAQ,
  COLLEGE_FINDER_TITLE,
  EXAM_PAGE_LIST,
  EXAM_PAGES,
  faqPageJsonLd,
  RANK_PREDICTOR_DESCRIPTION,
  RANK_PREDICTOR_FAQ,
  RANK_PREDICTOR_TITLE,
  rankPredictorFaq,
  webApplicationJsonLd,
} from "@/lib/seo/rank-predictor-seo";
import { RANK_PREDICTOR_EXAMS } from "@/lib/rank-predictor/types";
import { getAppRoutePolicy } from "@/server/route-policy";

const appDir = join(new URL("../../..", import.meta.url).pathname, "src/app");

test("one exam page per predictor exam, each public, with its own title, description and path", () => {
  assert.deepEqual(EXAM_PAGE_LIST.map((p) => p.exam).sort(), [...RANK_PREDICTOR_EXAMS].sort());
  const titles = new Set([RANK_PREDICTOR_TITLE, COLLEGE_FINDER_TITLE, ...EXAM_PAGE_LIST.map((p) => p.title)]);
  const descriptions = new Set([RANK_PREDICTOR_DESCRIPTION, COLLEGE_FINDER_DESCRIPTION, ...EXAM_PAGE_LIST.map((p) => p.description)]);
  assert.equal(titles.size, EXAM_PAGE_LIST.length + 2, "titles are unique");
  assert.equal(descriptions.size, EXAM_PAGE_LIST.length + 2, "descriptions are unique");
  for (const page of EXAM_PAGE_LIST) {
    assert.equal(page.path, `/rank-predictor/${page.exam}`);
    assert.equal(getAppRoutePolicy(page.path).kind, "public", page.path);
    assert.ok(page.points.length >= 3 && page.faq.length >= 2, `${page.exam} has its own copy`);
    assert.ok(existsSync(join(appDir, page.path, "page.tsx")), `${page.path} has a page file`);
  }
});

test("search snippets stay a sensible length", () => {
  for (const title of [RANK_PREDICTOR_TITLE, COLLEGE_FINDER_TITLE, ...EXAM_PAGE_LIST.map((p) => p.title)]) {
    assert.ok(title.length <= 60, `title too long for a search result (${title.length}): ${title}`);
  }
  for (const d of [RANK_PREDICTOR_DESCRIPTION, COLLEGE_FINDER_DESCRIPTION, ...EXAM_PAGE_LIST.map((p) => p.description)]) {
    assert.ok(d.length >= 70 && d.length <= 230, `description length ${d.length}: ${d}`);
  }
});

test("FAQ JSON-LD carries exactly the visible questions and answers", () => {
  const faq = rankPredictorFaq(EXAM_PAGES.neet.faq, true);
  const ld = faqPageJsonLd(faq) as { "@type": string; mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
  assert.equal(ld["@type"], "FAQPage");
  assert.deepEqual(
    ld.mainEntity.map((q) => [q.name, q.acceptedAnswer.text]),
    faq.map((q) => [q.question, q.answer]),
  );
  // The parse round-trip a crawler does.
  assert.deepEqual(JSON.parse(JSON.stringify(ld)), ld);
});

test("the college finder question is left out while the college finder is off", () => {
  const on = rankPredictorFaq([], true);
  const off = rankPredictorFaq([], false);
  assert.equal(on.length, RANK_PREDICTOR_FAQ.length);
  assert.equal(off.length, RANK_PREDICTOR_FAQ.length - 1);
  assert.ok(!off.some((q) => /college/i.test(q.question)));
  assert.ok(COLLEGE_FINDER_FAQ.length >= 3);
});

test("structured data: free web app, no ratings or reviews, breadcrumbs in order", () => {
  const app = webApplicationJsonLd({ siteUrl: "https://www.o3origin.com", path: "/rank-predictor", name: "x", description: "y" });
  assert.equal(app["@type"], "WebApplication");
  assert.equal(app.isAccessibleForFree, true);
  assert.deepEqual(app.offers, { "@type": "Offer", price: "0", priceCurrency: "INR" });
  const text = JSON.stringify(app);
  assert.ok(!/aggregateRating|review|ratingValue/i.test(text));
  const crumbs = breadcrumbJsonLd("https://www.o3origin.com", [
    { name: "Home", path: "/" },
    { name: "Rank Predictor", path: "/rank-predictor" },
  ]) as { itemListElement: { position: number; item: string }[] };
  assert.deepEqual(
    crumbs.itemListElement.map((c) => [c.position, c.item]),
    [
      [1, "https://www.o3origin.com"],
      [2, "https://www.o3origin.com/rank-predictor"],
    ],
  );
});

test("no unprovable claims in the search copy", () => {
  const all = JSON.stringify({ EXAM_PAGES, RANK_PREDICTOR_FAQ, COLLEGE_FINDER_FAQ, RANK_PREDICTOR_TITLE, RANK_PREDICTOR_DESCRIPTION, COLLEGE_FINDER_TITLE, COLLEGE_FINDER_DESCRIPTION });
  assert.ok(!/most accurate|100%|guaranteed|best rank predictor|#1/i.test(all));
});

test("robots: predictor pages and college finder crawlable, app trees still blocked, AI crawlers named", () => {
  const r = robots();
  const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
  const star = rules.find((rule) => rule.userAgent === "*");
  assert.ok(star);
  const disallow = ([] as string[]).concat(star.disallow ?? []);
  assert.ok(!disallow.some((d) => d.startsWith("/rank-predictor")), "no /rank-predictor disallow");
  for (const blocked of ["/api/", "/dashboard", "/admin", "/account", "/u/"]) assert.ok(disallow.includes(blocked), blocked);
  const named = new Set(rules.map((rule) => String(rule.userAgent)));
  for (const bot of ["OAI-SearchBot", "ChatGPT-User", "GPTBot", "Claude-SearchBot", "Claude-User", "ClaudeBot", "PerplexityBot", "Google-Extended", "Applebot", "DuckAssistBot"]) {
    assert.ok(named.has(bot), bot);
  }
  // Every named crawler gets exactly the same public surface as "*".
  for (const rule of rules) assert.deepEqual(rule.disallow, star.disallow, String(rule.userAgent));
});

test("logged-out visitors are not bounced home from the exam pages (AuthContext public list)", () => {
  // AuthContext keeps its own client-side list; without an entry the page loads, then redirects to /.
  const source = readFileSync(join(appDir, "..", "context", "AuthContext.tsx"), "utf8");
  const list = /const SHARED_PUBLIC_PATHS = \[([^\]]*)\]/.exec(source)?.[1] ?? "";
  // The exam paths come from EXAM_PAGE_LIST itself, so a new exam page is public on the client too.
  assert.ok(list.includes("...EXAM_PAGE_LIST.map((page) => page.path)"), "SHARED_PUBLIC_PATHS spreads EXAM_PAGE_LIST paths");
  assert.match(source, /import \{ EXAM_PAGE_LIST \} from '@\/lib\/seo\/rank-predictor-seo';/);
  assert.ok(list.includes("'/rank-predictor'") && list.includes("'/rank-predictor/colleges'"));
});
