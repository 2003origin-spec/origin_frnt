/**
 * Counselling engine (plan §11.2 seat matching, §11.3 chance bands). Pure:
 * no I/O; the server reads candidate cells from Postgres and passes them in.
 *
 * Bands, per seat cell (institute × program × quota × seat type × gender pool
 * × PwD) of one year, with the student's rank as a range [low, high]:
 *   Safe   — high ≤ 0.85 × round-1 closing (0.85 × final closing if round 1 is
 *            not loaded for that year)
 *   Likely — mid  ≤ final closing
 *   Reach  — low  ≤ 1.15 × final closing
 * (pessimistic end for Safe, optimistic end for Reach, plan §11.3). A typed
 * rank has low = high, so all three use the same number.
 *
 * Final closing: JoSAA / CSAB / official state tables → the last round we
 * have; cells derived from allotment lists (MCC, most states) → the highest
 * closing across the year's rounds (DATA_NOTES "Counselling — MCC").
 */

import { closingTrendHint } from "@/lib/rank-predictor/trend";

import { shortProgram } from "./names";
import { canonicalState, STATE_BODY_BY_STATE } from "./states";
import type {
  CellRound,
  ChanceBand,
  CounsellingBody,
  CounsellingCategory,
  CounsellingRanks,
  CounsellingResultRow,
  RankRange,
  RoundClosing,
} from "./types";

export const SAFE_FACTOR = 0.85;
export const REACH_FACTOR = 1.15;

// ---------------------------------------------------------------------------
// Seat types

type SeatMatch = { kind: "open" | "category"; femaleOnly: boolean; stateList: boolean };

const JOSAA_CATEGORY_SEAT: Record<CounsellingCategory, string | null> = {
  general: null,
  ews: "EWS",
  "obc-ncl": "OBC-NCL",
  sc: "SC",
  st: "ST",
};

const MCC_CATEGORY_SEAT: Record<CounsellingCategory, string | null> = {
  general: null,
  ews: "EWS",
  "obc-ncl": "OBC",
  sc: "SC",
  st: "ST",
};

/**
 * State quota seat codes we can read with confidence. Codes without a public
 * legend (RJ "OB"/"EB", OD "EB", BR "BC"/"EBC", KA rural/Kannada sub-lists…)
 * are left out rather than guessed.
 */
const STATE_SEATS: Partial<Record<CounsellingBody, { open: string[]; byCategory: Partial<Record<CounsellingCategory, string[]>> }>> = {
  state_ka: { open: ["GM"], byCategory: { sc: ["SCG"], st: ["STG"] } },
  state_tn: { open: [], byCategory: { sc: ["SC"], st: ["ST"] } },
  state_up: { open: ["UR"], byCategory: { "obc-ncl": ["BC"], sc: ["SC"], st: ["ST"], ews: ["EW"] } },
  state_mh: { open: ["OPEN"], byCategory: { "obc-ncl": ["OBC"], sc: ["SC"], st: ["ST"], ews: ["EWS"] } },
  state_rj: { open: ["UR"], byCategory: { sc: ["SC"], st: ["ST"] } },
  state_gj: { open: ["OPEN"], byCategory: { "obc-ncl": ["SE"], sc: ["SC"], st: ["ST"], ews: ["EW"] } },
  state_mp: { open: ["UR"], byCategory: { "obc-ncl": ["OBC"], sc: ["SC"], st: ["ST"], ews: ["EWS"] } },
  state_br: { open: ["UR"], byCategory: { sc: ["SC"], st: ["ST"], ews: ["EWS"] } },
  state_od: { open: ["OP"], byCategory: { sc: ["SC"], st: ["ST"] } },
};

/** How this seat type is open to the student, or null when it is not. */
export function matchSeatType(body: CounsellingBody, seatType: string, category: CounsellingCategory): SeatMatch | null {
  const seat = seatType.trim();
  if (body === "josaa" || body === "csab_special") {
    if (seat === "OPEN") return { kind: "open", femaleOnly: false, stateList: false };
    return JOSAA_CATEGORY_SEAT[category] === seat ? { kind: "category", femaleOnly: false, stateList: false } : null;
  }
  if (body === "csab_neut") {
    if (/^(UR|Open|OPEN)$/u.test(seat)) return { kind: "open", femaleOnly: false, stateList: false };
    if ((category === "sc" && seat === "SC") || (category === "st" && seat === "ST")) return { kind: "open", femaleOnly: false, stateList: false };
    return null;
  }
  if (body === "mcc_ug") {
    if (seat === "Open") return { kind: "open", femaleOnly: false, stateList: false };
    return MCC_CATEGORY_SEAT[category] === seat ? { kind: "category", femaleOnly: false, stateList: false } : null;
  }
  const rules = STATE_SEATS[body];
  if (!rules) return null;
  // Maharashtra marks women's seats with "(W)".
  const women = /\(W\)\s*$/u.test(seat);
  const code = seat.replace(/\s*\(W\)\s*$/u, "").trim();
  if (rules.open.includes(code)) return { kind: "open", femaleOnly: women, stateList: true };
  if ((rules.byCategory[category] ?? []).includes(code)) return { kind: "category", femaleOnly: women, stateList: true };
  return null;
}

/** Seat-type strings to ask the database for (the SQL pre-filter). */
export function seatTypesFor(body: CounsellingBody, category: CounsellingCategory): string[] {
  if (body === "josaa" || body === "csab_special") return ["OPEN", ...(JOSAA_CATEGORY_SEAT[category] ? [JOSAA_CATEGORY_SEAT[category] as string] : [])];
  if (body === "csab_neut") return ["UR", "Open", "OPEN", ...(category === "sc" ? ["SC"] : category === "st" ? ["ST"] : [])];
  if (body === "mcc_ug") return ["Open", ...(MCC_CATEGORY_SEAT[category] ? [MCC_CATEGORY_SEAT[category] as string] : [])];
  const rules = STATE_SEATS[body];
  if (!rules) return [];
  const codes = [...rules.open, ...(rules.byCategory[category] ?? [])];
  return body === "state_mh" ? codes.flatMap((c) => [c, `${c} (W)`, `${c}(W)`]) : codes;
}

// ---------------------------------------------------------------------------
// Quotas

const QUOTA_LABEL: Record<string, string> = {
  AI: "All India",
  HS: "Home state",
  OS: "Other state",
  GO: "Goa",
  JK: "Jammu & Kashmir",
  LA: "Ladakh",
  "Home State for Goa": "Goa",
  "Jammu & Kashmir (UT)": "Jammu & Kashmir",
  "Ladakh (UT)": "Ladakh",
};

export function quotaLabel(quota: string): string {
  return QUOTA_LABEL[quota] ?? quota;
}

/** MCC quotas any Indian candidate may fill. */
const MCC_OPEN_QUOTAS = new Set(["All India", "Open Seat Quota", "Deemed/Paid Seats Quota", "Self-Financed Merit Seat", "B.Sc Nursing All India"]);
/** MCC domicile quotas → the home state they need. */
const MCC_DOMICILE_QUOTAS: Record<string, string> = {
  "Delhi University Quota": "Delhi",
  "IP University Quota": "Delhi",
  "B.Sc Nursing Delhi NCR": "Delhi",
  "Internal -Puducherry UT Domicile": "Puducherry",
};

/**
 * Can a student from `homeState` ('' = not given) use this quota at this
 * institute? JoSAA rules (plan §11.2): HS when the state is one of the
 * institute's home states, OS otherwise; NIT Goa's GO and NIT Srinagar's
 * JK / LA quotas only for those states. Special-eligibility quotas (NRI, ESI,
 * minority, armed-forces wards, foreign) are never matched.
 */
export function quotaEligible(body: CounsellingBody, quota: string, homeState: string, instituteHomeStates: readonly string[]): boolean {
  const home = homeState ? canonicalState(homeState) : "";
  if (body === "josaa" || body === "csab_special") {
    switch (quota) {
      case "AI":
        return true;
      case "HS":
        // NIT Goa: Goa students use GO; HS is for its other home states.
        return Boolean(home) && instituteHomeStates.includes(home) && !(home === "Goa" && instituteHomeStates.length > 1);
      case "OS":
        return !home || !instituteHomeStates.includes(home);
      case "GO":
      case "Home State for Goa":
        return home === "Goa";
      case "JK":
      case "Jammu & Kashmir (UT)":
        return home === "Jammu and Kashmir";
      case "LA":
      case "Ladakh (UT)":
        return home === "Ladakh";
      default:
        return false; // DASA-* (foreign nationals) and anything unknown
    }
  }
  if (body === "csab_neut") return Boolean(home) && canonicalState(quota) === home;
  if (body === "mcc_ug") {
    if (MCC_OPEN_QUOTAS.has(quota)) return true;
    const need = MCC_DOMICILE_QUOTAS[quota];
    return Boolean(need) && need === home;
  }
  // State quota: only the state's own domicile students; NRI seats never.
  if (/NRI|^NQ$/iu.test(quota)) return false;
  return Boolean(home) && STATE_BODY_BY_STATE[home] === body;
}

// ---------------------------------------------------------------------------
// Which of the student's ranks a cell is compared with

export type RankChoice = { range: RankRange; label: string } | { missing: string };

export function rankFor(cell: Pick<CellRound, "body" | "rankBasis" | "pwd">, kind: "open" | "category", ranks: CounsellingRanks): RankChoice {
  const pick = (range: RankRange | undefined, label: string): RankChoice => (range ? { range, label } : { missing: label });
  switch (cell.rankBasis) {
    case "jee_adv":
      if (cell.pwd) return kind === "open" ? pick(ranks.jeeAdvPwdCrl, "JEE Advanced PwD rank") : pick(ranks.jeeAdvPwdCategory, "JEE Advanced category PwD rank");
      return kind === "open" ? pick(ranks.jeeAdvCrl, "JEE Advanced CRL") : pick(ranks.jeeAdvCategory, "JEE Advanced category rank");
    case "jee_main":
      if (cell.body === "csab_neut") return pick(ranks.jeeMainCrl, "JEE Main CRL");
      if (cell.pwd) return kind === "open" ? pick(ranks.jeeMainPwdCrl, "JEE Main PwD rank") : pick(ranks.jeeMainPwdCategory, "JEE Main category PwD rank");
      return kind === "open" ? pick(ranks.jeeMainCrl, "JEE Main CRL") : pick(ranks.jeeMainCategory, "JEE Main category rank");
    case "neet_air":
      return pick(ranks.neetAir, "NEET AIR");
    case "state_rank":
      return pick(ranks.neetTnStateRank, "Tamil Nadu state rank");
  }
}

// ---------------------------------------------------------------------------
// Bands

export type CellSummary = {
  rounds: RoundClosing[];
  /** Closing used for Likely / Reach. */
  final: number;
  finalPrep: boolean;
  /** Closing used for Safe (round 1, else final). */
  safeBase: number;
  safeBasePrep: boolean;
  hasRound1: boolean;
};

export function summariseCell(cellRounds: readonly CellRound[]): CellSummary {
  const sorted = [...cellRounds].sort((a, b) => a.round - b.round);
  const rounds: RoundClosing[] = sorted.map((r) => ({
    round: r.round,
    label: r.roundLabel,
    closing: r.closingRank,
    closingPrep: r.closingPrep,
    opening: r.openingRank,
  }));
  const derived = sorted.some((r) => r.derived !== "official");
  let finalRow: CellRound;
  if (derived) {
    // Highest closing across the year's rounds; a non-prep rank beats a prep one only by value.
    finalRow = sorted.reduce((best, r) => (r.closingRank > best.closingRank ? r : best), sorted[0]);
  } else {
    finalRow = sorted.find((r) => r.isFinal) ?? sorted[sorted.length - 1];
  }
  const r1 = sorted.find((r) => r.round === 1);
  return {
    rounds,
    final: finalRow.closingRank,
    finalPrep: finalRow.closingPrep,
    safeBase: r1 ? r1.closingRank : finalRow.closingRank,
    safeBasePrep: r1 ? r1.closingPrep : finalRow.closingPrep,
    hasRound1: Boolean(r1),
  };
}

export function midRank(range: RankRange): number {
  return Math.round((range.low + range.high) / 2);
}

/**
 * Safe / Likely / Reach, or null when the cell was out of reach. A closing
 * rank on the preparatory list (P) means every main-list rank in that seat
 * type would have got in.
 */
export function classify(summary: CellSummary, range: RankRange): ChanceBand | null {
  if (summary.safeBasePrep) return "safe";
  if (range.high <= SAFE_FACTOR * summary.safeBase) return "safe";
  if (summary.finalPrep) return "likely";
  if (midRank(range) <= summary.final) return "likely";
  if (range.low <= REACH_FACTOR * summary.final) return "reach";
  return null;
}

/** First round whose closing rank reached `rank` (the round it "opened" in). */
export function openedInRound(rounds: readonly RoundClosing[], rank: number): { round: number; label: string } | null {
  for (const r of rounds) if (r.closingPrep || r.closing >= rank) return { round: r.round, label: r.label };
  return null;
}

// ---------------------------------------------------------------------------
// Hints (text only; never change a band)

/** Median yearly drift of final closing ranks by institute type (research/trends-y2y.md §5). */
const DRIFT: Partial<Record<string, number>> = {
  IIT: 1.06,
  IISC: 1.06,
  NIT: 1.04,
  IIIT: 1.04,
  GFTI: 1.04,
  AIIMS: 1.03,
  JIPMER: 1.03,
  ESIC: 1.03,
  MED_CENTRAL: 1.03,
  MED_DEEMED: 1.03,
  MED_GOVT: 1.03,
};

const NUMBER = new Intl.NumberFormat("en-IN");

/** "Around 1,234 in 2027 if the usual yearly change holds" — rounded, text only. */
export function expectedNextYear(instituteType: string, finalClosing: number, year: number, prep: boolean): string | null {
  const drift = DRIFT[instituteType];
  if (!drift || prep) return null;
  const raw = finalClosing * drift;
  const step = raw >= 10000 ? 100 : raw >= 1000 ? 10 : 1;
  return `${year + 1}: closing rank maybe around ${NUMBER.format(Math.round(raw / step) * step)} if the usual yearly change holds`;
}

// ---------------------------------------------------------------------------
// Putting it together

export type MatchInput = {
  ranks: CounsellingRanks;
  category: CounsellingCategory;
  pwd: boolean;
  female: boolean;
  homeState: string;
};

export type MatchOutput = {
  rows: CounsellingResultRow[];
  /** Ranks the student did not give, which would have shown more seats. */
  missingRanks: string[];
};

export function cellKey(r: Pick<CellRound, "body" | "year" | "programId" | "quota" | "seatType" | "pwd" | "gender">): string {
  return [r.body, r.year, r.programId, r.quota, r.seatType, r.pwd ? 1 : 0, r.gender].join("|");
}

/** Same seat cell across years (for the trend line). */
export function seriesKey(r: Pick<CellRound, "body" | "programId" | "quota" | "seatType" | "pwd" | "gender">): string {
  return [r.body === "csab_neut" ? "csab_neut" : r.body, r.programId, r.quota, r.seatType, r.pwd ? 1 : 0, r.gender].join("|");
}

const DERIVED_NOTE: Record<string, string> = {
  from_allotments: "Closing rank worked out from the official allotment list (no official closing-rank table).",
  joined_merit_list: "Closing merit number matched to the state merit list to get the AIR.",
};

/**
 * Match candidate cells (all rounds of each cell, already pre-filtered by the
 * database) against the student. `history` = final closing per series key
 * and year for the trend line.
 */
export function matchCells(cells: readonly CellRound[], input: MatchInput, history: ReadonlyMap<string, { year: number; closing: number }[]> = new Map()): MatchOutput {
  const byCell = new Map<string, CellRound[]>();
  for (const c of cells) {
    const list = byCell.get(c.cellKey);
    if (list) list.push(c);
    else byCell.set(c.cellKey, [c]);
  }
  const rows: CounsellingResultRow[] = [];
  const missing = new Set<string>();
  for (const [key, list] of byCell) {
    const first = list[0];
    if (first.pwd && !input.pwd) continue;
    if (first.gender === "female" && !input.female) continue;
    const seat = matchSeatType(first.body, first.seatType, input.category);
    if (!seat) continue;
    if (seat.femaleOnly && !input.female) continue;
    if (!quotaEligible(first.body, first.quota, input.homeState, first.homeStates)) continue;
    const choice = rankFor(first, seat.kind, input.ranks);
    if ("missing" in choice) {
      missing.add(choice.missing);
      continue;
    }
    const summary = summariseCell(list);
    const band = classify(summary, choice.range);
    if (!band) continue;
    const rank = midRank(choice.range);
    const notes: string[] = [];
    if (summary.finalPrep || summary.safeBasePrep) notes.push("Seats went down to the preparatory (P) list, so every main-list rank in this seat type would have got one.");
    if (!summary.hasRound1) notes.push("Round 1 is not in our data for this year, so Safe uses the last round.");
    if (list.some((r) => r.precisionLost)) notes.push("The official site printed this rank rounded, so its last digits are not exact.");
    const derived = list.find((r) => r.derived !== "official")?.derived ?? "official";
    if (DERIVED_NOTE[derived]) notes.push(DERIVED_NOTE[derived]);
    if (seat.stateList && seat.kind === "category") notes.push("State category lists can differ from the central list: check your state certificate.");
    const femaleOnly = first.gender === "female" || seat.femaleOnly;
    const series = history.get(seriesKey(first)) ?? [];
    rows.push({
      key,
      band,
      body: first.body,
      year: first.year,
      institute: first.institute,
      instituteType: first.instituteType,
      state: first.instituteState,
      program: shortProgram(first.program),
      quota: first.quota,
      quotaLabel: quotaLabel(first.quota),
      seatType: first.seatType,
      pwd: first.pwd,
      femaleOnly,
      rankBasis: first.rankBasis,
      rankUsedLabel: choice.label,
      rankUsed: rank,
      rankUsedRange: choice.range,
      finalClosing: summary.final,
      finalClosingPrep: summary.finalPrep,
      rounds: summary.rounds,
      openedInRound: openedInRound(summary.rounds, rank),
      derived,
      precisionLost: list.some((r) => r.precisionLost),
      notes,
      trend: closingTrendHint(series),
      expectedNextYear: expectedNextYear(first.instituteType, summary.final, first.year, summary.finalPrep),
    });
  }
  return { rows, missingRanks: [...missing].sort() };
}

const BAND_ORDER: Record<ChanceBand, number> = { safe: 0, likely: 1, reach: 2 };

/** Group order Safe → Likely → Reach; inside a group, most competitive (lowest closing) first or closest to the student's rank first. */
export function sortRows(rows: CounsellingResultRow[], sort: "competitive" | "closest"): CounsellingResultRow[] {
  return [...rows].sort((a, b) => {
    const g = BAND_ORDER[a.band] - BAND_ORDER[b.band];
    if (g) return g;
    if (sort === "closest") {
      const da = Math.abs(a.finalClosing - a.rankUsed) / Math.max(1, a.rankUsed);
      const db = Math.abs(b.finalClosing - b.rankUsed) / Math.max(1, b.rankUsed);
      if (da !== db) return da - db;
    } else if (a.finalClosing !== b.finalClosing) {
      // Female-only pools close later; compare like for like first.
      return a.finalClosing - b.finalClosing;
    }
    return a.key.localeCompare(b.key);
  });
}
