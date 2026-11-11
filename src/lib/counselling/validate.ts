/**
 * Strict validation of POST /api/assessments/counselling/search (plan §7.3,
 * §12.3 Input Validation). Unknown keys are rejected, every enum is checked,
 * ranks are whole numbers in range, lists are short. Pure.
 */

import { isIndianStateName } from "./states";
import {
  CHANCE_BANDS,
  COUNSELLING_CATEGORIES,
  INSTITUTE_TYPES,
  JEE_BODIES,
  NEET_BODIES,
  type CounsellingBody,
  type CounsellingRanks,
  type CounsellingSearchInput,
  type InstituteType,
  type RankRange,
} from "./types";

export const MAX_PAGE_SIZE = 50;
export const MAX_PAGE = 200;
export const MAX_RANK = 2_500_000;
export const MAX_BRANCH_QUERY = 60;
export const MAX_BODY_BYTES = 4096;

const RANK_KEYS = [
  "jeeAdvCrl",
  "jeeAdvCategory",
  "jeeAdvPwdCrl",
  "jeeAdvPwdCategory",
  "jeeMainCrl",
  "jeeMainCategory",
  "jeeMainPwdCrl",
  "jeeMainPwdCategory",
  "neetAir",
  "neetTnStateRank",
] as const satisfies readonly (keyof CounsellingRanks)[];

const JEE_RANK_KEYS = new Set<string>(RANK_KEYS.filter((k) => k.startsWith("jee")));
const NEET_RANK_KEYS = new Set<string>(["neetAir", "neetTnStateRank"]);

const TOP_KEYS = new Set(["exam", "ranks", "category", "pwd", "gender", "homeState", "filters", "page", "pageSize"]);
const FILTER_KEYS = new Set(["bodies", "years", "instituteTypes", "states", "branchQuery", "roundMode", "band", "sort"]);

export type ValidationError = { field: string; message: string };
export type ValidationResult = { ok: true; value: CounsellingSearchInput } | { ok: false; error: ValidationError };

const fail = (field: string, message: string): ValidationResult => ({ ok: false, error: { field, message } });

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function rankValue(v: unknown): RankRange | null {
  const ok = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= MAX_RANK;
  if (ok(v)) return { low: v, high: v };
  if (isPlainObject(v) && Object.keys(v).every((k) => k === "low" || k === "high") && ok(v.low) && ok(v.high) && v.low <= v.high) {
    return { low: v.low, high: v.high };
  }
  return null;
}

function stringList<T extends string>(v: unknown, allowed: readonly T[], max: number): T[] | null {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.length > max) return null;
  const out: T[] = [];
  for (const item of v) {
    if (typeof item !== "string" || !(allowed as readonly string[]).includes(item)) return null;
    if (!out.includes(item as T)) out.push(item as T);
  }
  return out;
}

/** Keep letters, digits, spaces and a few name characters; trim and cap. */
export function cleanBranchQuery(v: string): string {
  return v
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N} .&()/+-]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, MAX_BRANCH_QUERY);
}

export function validateSearchInput(raw: unknown): ValidationResult {
  if (!isPlainObject(raw)) return fail("body", "Send a JSON object.");
  for (const k of Object.keys(raw)) if (!TOP_KEYS.has(k)) return fail(k, `Unknown field "${k}".`);

  const exam = raw.exam;
  if (exam !== "jee" && exam !== "neet") return fail("exam", "Pick JEE or NEET.");

  if (!isPlainObject(raw.ranks)) return fail("ranks", "Enter at least one rank.");
  const ranks: CounsellingRanks = {};
  const examKeys = exam === "jee" ? JEE_RANK_KEYS : NEET_RANK_KEYS;
  for (const [k, v] of Object.entries(raw.ranks)) {
    if (!(RANK_KEYS as readonly string[]).includes(k)) return fail(`ranks.${k}`, `Unknown rank "${k}".`);
    if (!examKeys.has(k)) return fail(`ranks.${k}`, "This rank is for the other exam.");
    if (v === null || v === undefined) continue;
    const r = rankValue(v);
    if (!r) return fail(`ranks.${k}`, `Enter a whole-number rank from 1 to ${MAX_RANK.toLocaleString("en-IN")}.`);
    ranks[k as keyof CounsellingRanks] = r;
  }
  if (!Object.keys(ranks).length) return fail("ranks", "Enter at least one rank.");

  const category = raw.category;
  if (typeof category !== "string" || !(COUNSELLING_CATEGORIES as readonly string[]).includes(category)) return fail("category", "Pick a category.");
  if (typeof raw.pwd !== "boolean") return fail("pwd", "PwD must be yes or no.");
  const gender = raw.gender;
  if (gender !== "male" && gender !== "female" && gender !== "other") return fail("gender", "Pick a gender.");
  const homeState = raw.homeState ?? "";
  if (typeof homeState !== "string" || (homeState !== "" && !isIndianStateName(homeState))) return fail("homeState", "Pick a state from the list.");

  const filters = raw.filters ?? {};
  if (!isPlainObject(filters)) return fail("filters", "Bad filters.");
  for (const k of Object.keys(filters)) if (!FILTER_KEYS.has(k)) return fail(`filters.${k}`, `Unknown filter "${k}".`);
  const examBodies: readonly CounsellingBody[] = exam === "jee" ? JEE_BODIES : NEET_BODIES;
  const bodies = stringList(filters.bodies, examBodies, examBodies.length);
  if (!bodies) return fail("filters.bodies", "Unknown counselling body for this exam.");
  if (filters.years !== undefined && (!Array.isArray(filters.years) || filters.years.length > 6 || !filters.years.every((y) => Number.isInteger(y) && y >= 2020 && y <= 2100))) {
    return fail("filters.years", "Bad year.");
  }
  const years = [...new Set((filters.years as number[] | undefined) ?? [])];
  const instituteTypes = stringList<InstituteType>(filters.instituteTypes, INSTITUTE_TYPES, INSTITUTE_TYPES.length);
  if (!instituteTypes) return fail("filters.instituteTypes", "Unknown institute type.");
  if (filters.states !== undefined && (!Array.isArray(filters.states) || filters.states.length > 40 || !filters.states.every(isIndianStateName))) {
    return fail("filters.states", "Pick states from the list.");
  }
  const states = [...new Set((filters.states as string[] | undefined) ?? [])];
  if (filters.branchQuery !== undefined && (typeof filters.branchQuery !== "string" || filters.branchQuery.length > 200)) return fail("filters.branchQuery", "Branch search is too long.");
  const branchQuery = cleanBranchQuery((filters.branchQuery as string | undefined) ?? "");
  const roundMode = filters.roundMode ?? "each";
  if (roundMode !== "final" && roundMode !== "each") return fail("filters.roundMode", "Bad round view.");
  const band = filters.band ?? "all";
  if (band !== "all" && !(CHANCE_BANDS as readonly string[]).includes(band as string)) return fail("filters.band", "Bad chance group.");
  const sort = filters.sort ?? "competitive";
  if (sort !== "competitive" && sort !== "closest") return fail("filters.sort", "Bad sort.");

  const page = raw.page ?? 1;
  if (!Number.isInteger(page) || (page as number) < 1 || (page as number) > MAX_PAGE) return fail("page", "Bad page.");
  const pageSize = raw.pageSize ?? MAX_PAGE_SIZE;
  if (!Number.isInteger(pageSize) || (pageSize as number) < 1 || (pageSize as number) > MAX_PAGE_SIZE) return fail("pageSize", `Page size is 1 to ${MAX_PAGE_SIZE}.`);

  return {
    ok: true,
    value: {
      exam,
      ranks,
      category: category as CounsellingSearchInput["category"],
      pwd: raw.pwd,
      gender,
      homeState,
      filters: {
        bodies,
        years,
        instituteTypes,
        states,
        branchQuery,
        roundMode,
        band: band as CounsellingSearchInput["filters"]["band"],
        sort,
      },
      page: page as number,
      pageSize: pageSize as number,
    },
  };
}

/** LIKE pattern for a branch search: wildcards in the text are matched literally. */
export function likePattern(query: string): string {
  return `%${query.replace(/[\\%_]/gu, (c) => `\\${c}`)}%`;
}
