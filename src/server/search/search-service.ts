/**
 * Universal student search (Phase 5).
 *
 * Fans a query out to per-domain adapters (tests, OG-Code questions, people, AI
 * sessions, navigation), scores + merges the results, and returns deep-linkable
 * hits. Replaces the old `GlobalSearch` which searched a hardcoded mock array.
 *
 * ENGINE-AGNOSTIC BY DESIGN. Each `search<Domain>` adapter is the only place that
 * talks to a data source, and `scoreMatch` / `rankAndMergeResults` are pure. To
 * move a domain onto Elasticsearch/Meilisearch later, swap that one adapter's
 * body to query the engine and return `SearchResult[]`; nothing else changes.
 * Today the adapters use Postgres (ILIKE / existing catalog + social search) so
 * the feature ships with zero new infrastructure.
 */

import type { AppStore, StoredUser } from "@/server/store";
import { listTestPreviews } from "@/server/assessments";
import { listOgcodeCatalogQuestionPage } from "@/server/ogcode-catalog";
import { searchStudents } from "@/server/social/social-service";
import { isFeatureEnabled } from "@/lib/feature-flags";

export type SearchScope = "all" | "tests" | "questions" | "people" | "ai" | "books";
export type SearchResultType = "test" | "question" | "person" | "ai" | "book" | "nav";

export type SearchResult = {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string;
  /** Deep link the client pushes on select. */
  href: string;
  /** Relevance score (higher = better). */
  score: number;
};

export type SearchResponse = {
  query: string;
  results: SearchResult[];
};

const PER_DOMAIN_LIMIT = 6;
const DEFAULT_TOTAL_LIMIT = 8;

/**
 * Pure relevance score of `text` against `query`. Exact > prefix > word-start >
 * substring (earlier substring wins). Returns 0 for no match.
 */
export function scoreMatch(text: string | null | undefined, query: string): number {
  const t = String(text ?? "").toLowerCase().trim();
  const q = query.toLowerCase().trim();
  if (!t || !q) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.split(/\s+/).some((word) => word.startsWith(q))) return 60;
  const idx = t.indexOf(q);
  if (idx >= 0) return 40 - Math.min(20, idx);
  return 0;
}

/**
 * Pure merge: dedupe by type+id, sort by score desc (stable — equal scores keep
 * the caller's domain order), cap at `limit`.
 */
export function rankAndMergeResults(results: readonly SearchResult[], limit: number): SearchResult[] {
  const seen = new Set<string>();
  const unique: SearchResult[] = [];
  for (const result of results) {
    const key = `${result.type}:${result.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(result);
  }
  unique.sort((left, right) => right.score - left.score);
  return unique.slice(0, Math.max(0, limit));
}

function truncate(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

type PreviewLike = { id: string; title?: string; description?: string; subject?: string };

async function searchTests(store: AppStore, user: StoredUser, query: string): Promise<SearchResult[]> {
  const previews = (await listTestPreviews(store, user)) as PreviewLike[];
  return previews
    .map((test) => ({
      test,
      score: Math.max(scoreMatch(test.title, query), scoreMatch(test.description, query) - 15),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, PER_DOMAIN_LIMIT)
    .map(({ test, score }) => ({
      type: "test" as const,
      id: test.id,
      title: test.title ?? "Untitled test",
      subtitle: `Test${test.subject ? ` · ${test.subject}` : ""}`,
      href: `/tests/${test.id}`,
      score,
    }));
}

async function searchQuestions(query: string): Promise<SearchResult[]> {
  const { items } = await listOgcodeCatalogQuestionPage({ search: query, limit: PER_DOMAIN_LIMIT, offset: 0 });
  return items.map((question) => ({
    type: "question" as const,
    id: question.id,
    title: question.chapter || question.concept || "Practice question",
    // The catalog already matched text/chapter/concept/tags; title match boosts.
    subtitle: `Question · ${truncate(question.text ?? "", 60)}`,
    href: `/ogcode/${question.id}`,
    score: Math.max(60, scoreMatch(question.chapter, query), scoreMatch(question.concept, query)),
  }));
}

async function searchPeople(userId: string, query: string): Promise<SearchResult[]> {
  if (!isFeatureEnabled("studentSocial")) return [];
  const cards = await searchStudents(userId, query, PER_DOMAIN_LIMIT);
  return cards
    .filter((card) => card.username)
    .map((card) => ({
      type: "person" as const,
      id: card.id,
      title: card.name,
      subtitle: `@${card.username}`,
      href: `/u/${card.username}`,
      score: Math.max(60, scoreMatch(card.name, query), scoreMatch(card.username, query)),
    }));
}

function searchAiSessions(store: AppStore, userId: string, query: string): SearchResult[] {
  return store.doubtSessions
    .filter((session) => session.userId === userId)
    .map((session) => ({ session, score: scoreMatch(session.title, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, PER_DOMAIN_LIMIT)
    .map(({ session, score }) => ({
      type: "ai" as const,
      id: session.id,
      title: session.title || "AI session",
      subtitle: "AI chat session",
      href: "/doubt-solver",
      score,
    }));
}

const NAV_ENTRIES: Array<{ id: string; title: string; keywords: string; href: string }> = [
  { id: "dashboard", title: "My Dashboard", keywords: "dashboard home overview", href: "/dashboard" },
  { id: "tests", title: "Test Series", keywords: "tests mock jee neet pyq", href: "/tests" },
  { id: "ogcode", title: "OGCode Workspace", keywords: "ogcode practice questions problems", href: "/ogcode" },
  { id: "leaderboard", title: "Leaderboard", keywords: "leaderboard rank hall of fame prestige", href: "/leaderboard" },
  { id: "study-corner", title: "NCERT Library", keywords: "books ncert library study notes", href: "/study-corner" },
  { id: "doubt-solver", title: "AI Study Mentor", keywords: "ai doubt solver mentor tutor", href: "/doubt-solver" },
  { id: "dpp", title: "Daily Practice (DPP)", keywords: "dpp daily practice problems", href: "/dpp" },
  { id: "pomodoro", title: "Pomodoro Timer", keywords: "pomodoro focus timer study music", href: "/pomodoro" },
  { id: "social", title: "Social", keywords: "social follow friends community", href: "/social" },
  { id: "milestones", title: "Prestige Journey", keywords: "prestige milestones points rank", href: "/milestones" },
];

function searchNav(query: string): SearchResult[] {
  return NAV_ENTRIES.map((entry) => ({
    entry,
    score: Math.max(scoreMatch(entry.title, query), scoreMatch(entry.keywords, query) - 5),
  }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, PER_DOMAIN_LIMIT)
    .map(({ entry, score }) => ({
      type: "nav" as const,
      id: entry.id,
      title: entry.title,
      subtitle: "Go to page",
      href: entry.href,
      score,
    }));
}

/**
 * Run the universal search. `scope` narrows to a single domain; `"all"` fans out
 * to every domain plus navigation. Adapter failures are isolated so one slow /
 * misconfigured source never blanks the whole result set.
 */
export async function searchAll(options: {
  store: AppStore;
  user: StoredUser;
  query: string;
  scope?: SearchScope;
  limit?: number;
}): Promise<SearchResponse> {
  const query = options.query.trim();
  const scope: SearchScope = options.scope ?? "all";
  const limit = options.limit ?? DEFAULT_TOTAL_LIMIT;
  if (query.length < 1) return { query, results: [] };

  const wants = (domain: SearchScope) => scope === "all" || scope === domain;

  const asyncTasks: Promise<SearchResult[]>[] = [];
  if (wants("tests")) asyncTasks.push(searchTests(options.store, options.user, query));
  if (wants("questions")) asyncTasks.push(searchQuestions(query));
  if (wants("people")) asyncTasks.push(searchPeople(options.user.id, query));

  const settled = await Promise.allSettled(asyncTasks);
  const collected = settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));

  const syncResults: SearchResult[] = [];
  if (wants("ai")) syncResults.push(...searchAiSessions(options.store, options.user.id, query));
  if (scope === "all") syncResults.push(...searchNav(query));

  const results = rankAndMergeResults([...collected, ...syncResults], limit);
  return { query, results };
}
