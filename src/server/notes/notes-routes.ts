/**
 * Tiny route table matcher for the two Notes catch-all API routes
 * (/api/notes/[...slug] and /api/admin/notes/[...slug]). One catch-all per
 * surface is the repo rule since the Next 16 "new route file missing from the
 * build" incident (new-frontend/AGENTS.md).
 */

export type NotesRoute<H> = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  /** Literal segments, or `:name` to capture one segment. */
  pattern: readonly string[];
  handler: H;
};

export function matchSegments(pattern: readonly string[], slug: readonly string[]): Record<string, string> | null {
  if (pattern.length !== slug.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pattern.length; i += 1) {
    const part = pattern[i];
    if (part.startsWith(":")) {
      const value = slug[i];
      // Ids are short tokens; anything else is not a route we serve.
      if (!/^[A-Za-z0-9_.-]{1,120}$/u.test(value)) return null;
      params[part.slice(1)] = value;
    } else if (part !== slug[i]) {
      return null;
    }
  }
  return params;
}

export function findRoute<H>(
  routes: readonly NotesRoute<H>[],
  method: string,
  slug: readonly string[],
): { route: NotesRoute<H>; params: Record<string, string> } | { route: null; methodMismatch: boolean } {
  let methodMismatch = false;
  for (const route of routes) {
    const params = matchSegments(route.pattern, slug);
    if (!params) continue;
    if (route.method === method) return { route, params };
    methodMismatch = true;
  }
  return { route: null, methodMismatch };
}
