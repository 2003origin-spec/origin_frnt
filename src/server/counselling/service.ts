import "server-only";

/**
 * College finder search + meta (plan §7.3, §11). The browser never gets a
 * cut-off table: one search reads only the cells near the student's rank and
 * returns at most one page (≤ 50 rows) plus group counts.
 */

import { BODY_DATA_NOTE, BODY_LABEL, COUNSELLING_DISCLAIMER, JEE_INSTITUTE_TYPES, NEET_INSTITUTE_TYPES, OFFICIAL_LINKS } from "@/lib/counselling/format";
import { REACH_FACTOR, matchCells, seatTypesFor, seriesKey, sortRows, summariseCell } from "@/lib/counselling/match";
import { closingTrendHint } from "@/lib/rank-predictor/trend";
import { STATE_BODY_BY_STATE } from "@/lib/counselling/states";
import {
  JEE_BODIES,
  NEET_BODIES,
  type CellRound,
  type ChanceBand,
  type CounsellingBody,
  type CounsellingExam,
  type CounsellingRanks,
  type CounsellingResultRow,
  type CounsellingSearchInput,
  type InstituteType,
  type RankBasis,
} from "@/lib/counselling/types";
import { likePattern } from "@/lib/counselling/validate";

import { listDatasets, listInstituteStates, readCandidateCells, readHistory, type DatasetRow } from "@/server/counselling/repository";

const CACHE_MS = 5 * 60 * 1000;
let datasetCache: { at: number; rows: Promise<DatasetRow[]> } | null = null;

/** The datasets list is ~75 rows and changes once a year: cached for 5 minutes per server instance. */
function datasets(): Promise<DatasetRow[]> {
  const now = Date.now();
  if (!datasetCache || now - datasetCache.at > CACHE_MS) {
    const rows = listDatasets();
    datasetCache = { at: now, rows };
    rows.catch(() => {
      datasetCache = null;
    });
  }
  return datasetCache.rows;
}

/** Tests only. */
export function resetCounsellingCache(): void {
  datasetCache = null;
}

export type BodyMeta = {
  body: CounsellingBody;
  label: string;
  note: string | null;
  years: { year: number; rounds: { round: number; label: string; isFinal: boolean }[] }[];
  sources: { publisher: string; url: string; official: boolean; fetchedOn: string | null }[];
};

export type CounsellingMeta = {
  exam: CounsellingExam;
  bodies: BodyMeta[];
  instituteTypes: readonly InstituteType[];
  states: string[];
  checkedOn: string | null;
  disclaimer: string;
  officialLinks: { label: string; url: string }[];
};

function bodyMeta(rows: DatasetRow[], body: CounsellingBody): BodyMeta | null {
  const mine = rows.filter((r) => r.body === body);
  if (!mine.length) return null;
  const years = [...new Set(mine.map((r) => r.year))].sort((a, b) => b - a);
  const sources = new Map<string, BodyMeta["sources"][number]>();
  for (const r of mine) {
    if (r.sourceUrl && r.publisher && !sources.has(r.sourceUrl)) {
      sources.set(r.sourceUrl, { publisher: r.publisher, url: r.sourceUrl, official: r.official, fetchedOn: r.fetchedOn });
    }
  }
  return {
    body,
    label: BODY_LABEL[body],
    note: BODY_DATA_NOTE[body] ?? null,
    years: years.map((year) => ({
      year,
      rounds: mine.filter((r) => r.year === year).map((r) => ({ round: r.round, label: r.roundLabel, isFinal: r.isFinal })),
    })),
    sources: [...sources.values()],
  };
}

function latestCheckedOn(rows: DatasetRow[]): string | null {
  const iso = rows
    .map((r) => r.fetchedOn)
    .filter((d): d is string => Boolean(d))
    .map((d) => d.split("/").reverse().join("-"))
    .sort();
  const last = iso[iso.length - 1];
  return last ? last.split("-").reverse().join("/") : null;
}

export async function getCounsellingMeta(exam: CounsellingExam): Promise<CounsellingMeta> {
  const rows = await datasets();
  const bodies = (exam === "jee" ? JEE_BODIES : NEET_BODIES).map((b) => bodyMeta(rows, b)).filter((b): b is BodyMeta => Boolean(b));
  const groups = exam === "jee" ? ["josaa"] : [...NEET_BODIES];
  return {
    exam,
    bodies,
    instituteTypes: exam === "jee" ? JEE_INSTITUTE_TYPES : NEET_INSTITUTE_TYPES,
    states: await listInstituteStates(groups),
    checkedOn: latestCheckedOn(rows.filter((r) => bodies.some((b) => b.body === r.body))),
    disclaimer: COUNSELLING_DISCLAIMER,
    officialLinks: OFFICIAL_LINKS.filter((l) => l.exam === exam).map(({ label, url }) => ({ label, url })),
  };
}

/** Smallest rank the student could use per basis (the SQL pre-filter); null = no rank for that basis. */
export function rankBounds(ranks: CounsellingRanks): Record<RankBasis, number | null> {
  const min = (...r: (CounsellingRanks[keyof CounsellingRanks] | undefined)[]) => {
    const lows = r.filter((x): x is NonNullable<typeof x> => Boolean(x)).map((x) => x.low);
    return lows.length ? Math.min(...lows) : null;
  };
  return {
    jee_adv: min(ranks.jeeAdvCrl, ranks.jeeAdvCategory, ranks.jeeAdvPwdCrl, ranks.jeeAdvPwdCategory),
    jee_main: min(ranks.jeeMainCrl, ranks.jeeMainCategory, ranks.jeeMainPwdCrl, ranks.jeeMainPwdCategory),
    neet_air: min(ranks.neetAir),
    state_rank: min(ranks.neetTnStateRank),
  };
}

/** Bodies searched when the student picks none: JoSAA + CSAB; MCC + their own state's list. */
export function defaultBodies(exam: CounsellingExam, homeState: string, available: readonly CounsellingBody[]): CounsellingBody[] {
  const wanted: CounsellingBody[] =
    exam === "jee" ? ["josaa", "csab_special", "csab_neut"] : ["mcc_ug", ...((STATE_BODY_BY_STATE[homeState] ? [STATE_BODY_BY_STATE[homeState]] : []) as CounsellingBody[])];
  return wanted.filter((b) => available.includes(b));
}

export type SearchResponse = {
  rows: CounsellingResultRow[];
  page: number;
  pageSize: number;
  total: number;
  counts: Record<ChanceBand, number>;
  truncated: boolean;
  searched: { body: CounsellingBody; label: string; year: number }[];
  missingRanks: string[];
  notes: string[];
  disclaimer: string;
};

export async function searchCounselling(input: CounsellingSearchInput): Promise<SearchResponse> {
  const allDatasets = await datasets();
  const examBodies: readonly CounsellingBody[] = input.exam === "jee" ? JEE_BODIES : NEET_BODIES;
  const available = examBodies.filter((b) => allDatasets.some((d) => d.body === b));
  const bodies = input.filters.bodies.length ? input.filters.bodies.filter((b) => available.includes(b)) : defaultBodies(input.exam, input.homeState, available);

  // Years: the ones asked for, else each body's latest year.
  const searched: SearchResponse["searched"] = [];
  for (const body of bodies) {
    const years = [...new Set(allDatasets.filter((d) => d.body === body).map((d) => d.year))];
    const pick = input.filters.years.length ? years.filter((y) => input.filters.years.includes(y)) : years.length ? [Math.max(...years)] : [];
    for (const year of pick.sort((a, b) => b - a)) searched.push({ body, label: BODY_LABEL[body], year });
  }

  const notes: string[] = [];
  if (!input.homeState) notes.push("Add your home state to see home-state (HS) and state quota seats; without it we show other-state (OS) seats only.");
  if (input.exam === "neet" && input.homeState && !STATE_BODY_BY_STATE[input.homeState]) {
    notes.push(`We do not have ${input.homeState}'s state quota list yet, so only MCC All India seats are shown.`);
  }
  notes.push("Seats that need special eligibility (NRI, ESI, minority, armed-forces wards, foreign nationals) are not shown.");

  const empty: SearchResponse = {
    rows: [],
    page: input.page,
    pageSize: input.pageSize,
    total: 0,
    counts: { safe: 0, likely: 0, reach: 0 },
    truncated: false,
    searched,
    missingRanks: [],
    notes,
    disclaimer: COUNSELLING_DISCLAIMER,
  };
  if (!searched.length) return empty;

  const usedBodies = [...new Set(searched.map((s) => s.body))];
  const { cells, truncated } = await readCandidateCells({
    bodies: usedBodies,
    years: [...new Set(searched.map((s) => s.year))],
    seatPairs: usedBodies.flatMap((body) => seatTypesFor(body, input.category).map((seatType) => ({ body, seatType }))),
    includePwd: input.pwd,
    includeFemale: input.gender === "female",
    instituteTypes: input.filters.instituteTypes,
    states: input.filters.states,
    branchPattern: input.filters.branchQuery ? likePattern(input.filters.branchQuery) : null,
    bounds: rankBounds(input.ranks),
    reachFactor: REACH_FACTOR,
  });
  // A year asked for one body must not leak in from another body's year list.
  const wanted = new Set(searched.map((s) => `${s.body}|${s.year}`));
  const scoped = cells.filter((c) => wanted.has(`${c.body}|${c.year}`));

  const { rows, missingRanks } = matchCells(scoped, {
    ranks: input.ranks,
    category: input.category,
    pwd: input.pwd,
    female: input.gender === "female",
    homeState: input.homeState,
  });
  const counts: Record<ChanceBand, number> = { safe: 0, likely: 0, reach: 0 };
  for (const r of rows) counts[r.band] += 1;
  const filtered = input.filters.band === "all" ? rows : rows.filter((r) => r.band === input.filters.band);
  const sorted = sortRows(filtered, input.filters.sort);
  const start = (input.page - 1) * input.pageSize;
  const page = sorted.slice(start, start + input.pageSize);

  await addTrends(page, usedBodies);
  if (input.filters.roundMode === "final") {
    for (const r of page) r.rounds = r.rounds.filter((x) => x.closing === r.finalClosing).slice(-1);
  }
  if (truncated) notes.push("Too many seats matched: narrow the filters (type, state or branch) to see all of them.");

  return { ...empty, rows: page, total: filtered.length, counts, truncated, missingRanks, notes };
}

/** "closing rank rose 3 years in a row" for the rows on this page (text only). */
async function addTrends(rows: CounsellingResultRow[], bodies: CounsellingBody[]): Promise<void> {
  if (!rows.length) return;
  const programIds = [...new Set(rows.map((r) => Number(r.key.split("|")[2])))];
  const history = await readHistory(bodies, programIds);
  const byCellYear = new Map<string, CellRound[]>();
  for (const h of history) {
    const k = `${seriesKey(h)}#${h.year}`;
    const list = byCellYear.get(k) ?? [];
    list.push({ ...(h as CellRound), cellKey: k });
    byCellYear.set(k, list);
  }
  const series = new Map<string, { year: number; closing: number }[]>();
  for (const [k, list] of byCellYear) {
    const [s, year] = k.split("#");
    const sum = summariseCell(list);
    if (sum.finalPrep) continue;
    const arr = series.get(s) ?? [];
    arr.push({ year: Number(year), closing: sum.final });
    series.set(s, arr);
  }
  for (const r of rows) {
    const [body, , programId, quota, seatType, pwd, gender] = r.key.split("|");
    const key = seriesKey({ body: body as CounsellingBody, programId: Number(programId), quota, seatType, pwd: pwd === "1", gender: gender as "neutral" | "female" });
    // Only years up to the row's own year count for its trend.
    r.trend = closingTrendHint((series.get(key) ?? []).filter((p) => p.year <= r.year));
  }
}
