/**
 * "Where does this data come from" for the Rank Predictor and the college
 * finder: one sentence that says the data is public, and the list of source
 * links written out in full. No React here, so it can be unit tested.
 */

/** Said next to every result, followed by a "Sources" link to the list below. */
export const PUBLIC_DATA_ACK = "This data is collected and worked out from publicly available data.";

/** The id the "Sources" link jumps to. One list per page. */
export const SOURCES_ANCHOR_ID = "sources";

/** How many links a group shows before the rest fold under "Show N more links". */
export const SOURCE_LINKS_SHOWN = 4;

export type SourceLink = { url: string; publisher?: string | null; official?: boolean };

export type SourceGroup = { key: string; label: string; links: SourceLink[] };

/**
 * Every http(s) link inside a source field. Most fields are one link; a few
 * hold several ("a ; b ; c") or a link followed by a note ("… (menu > page)").
 * Only web links are ever written out; anything else in the data is dropped.
 */
export function linksIn(url: unknown): string[] {
  if (typeof url !== "string") return [];
  return (url.match(/https?:\/\/[^\s;,<>"']+/gu) ?? []).map((u) => u.replace(/[).]+$/u, "")).filter((u) => /^https?:\/\/[^/]+\.[^/]+/u.test(u));
}

/**
 * Groups for the list: same label merged, each link once per group (first
 * spelling wins), groups without a usable link dropped, order kept.
 */
export function sourceGroups(input: readonly { key?: string; label: string; links: readonly SourceLink[] }[]): SourceGroup[] {
  const groups = new Map<string, SourceGroup>();
  for (const g of input) {
    const label = g.label.trim();
    if (!label) continue;
    const group = groups.get(label) ?? { key: g.key ?? label, label, links: [] };
    for (const link of g.links) {
      for (const url of linksIn(link.url)) {
        if (group.links.some((l) => l.url === url)) continue;
        group.links.push({ ...link, url });
      }
    }
    groups.set(label, group);
  }
  return [...groups.values()].filter((g) => g.links.length > 0);
}

/** The links a group shows at once, and the ones folded under "Show N more links". */
export function splitLinks(links: readonly SourceLink[], shown: number = SOURCE_LINKS_SHOWN): { first: SourceLink[]; rest: SourceLink[] } {
  // One left over is not worth a fold: show it.
  if (links.length <= shown + 1) return { first: [...links], rest: [] };
  return { first: links.slice(0, shown), rest: links.slice(shown) };
}
