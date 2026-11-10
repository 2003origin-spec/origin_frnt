/**
 * Rank Predictor — shared types (client-safe: no data, no I/O).
 *
 * The engine (`predict.ts`) is pure: every function takes the parsed data file
 * as an argument, so tests can feed it a trimmed or broken copy. The real data
 * files are loaded only by server code (`src/server/rank-predictor/data.ts`),
 * never shipped to the browser. Plan: V1/PERCENTILE_PREDICTOR_PLAN.md §4–§6.
 */

export type RankPredictorExam = "neet" | "jee-main" | "jee-advanced";

export const RANK_PREDICTOR_EXAMS: readonly RankPredictorExam[] = ["neet", "jee-main", "jee-advanced"];

/** Category ids, the same for every exam (labels differ per exam, see format.ts). */
export type RankCategory = "general" | "ews" | "obc-ncl" | "sc" | "st";

export const RANK_CATEGORIES: readonly RankCategory[] = ["general", "ews", "obc-ncl", "sc", "st"];

/** Plan §5: every number carries one of these. */
export type Quality = "good_estimate" | "estimate" | "rough";

export type SourceKind = "manual" | "attempt" | "avg3";

export type NumberRange = { low: number; high: number };

export type RankBand = NumberRange & {
  quality: Quality;
  /** Plan §5 thin-data rule: shown as "Not enough data for an exact range". */
  notEnoughData?: boolean;
  /** What the rank is (e.g. "OBC-NCL rank", "Karnataka state rank"). */
  label?: string;
};

export type PercentileBand = NumberRange & { quality: Quality };

export type StateRankStatus = "ok" | "coming_soon" | "not_available" | "not_selected";

export type EligibilityStatus = "likely" | "borderline" | "not_eligible";

export type JeeAdvEligibility = {
  status: EligibilityStatus;
  year: number;
  /** The category's JEE (Advanced) eligibility cut-off percentile that year. */
  cutoff: number;
  /** The cut-off key used in the data ("UR", "OBC-NCL", "UR-PwD", …). */
  cutoffKey: string;
};

export type QualifyingYear = { year: number; qualifies: boolean; minMarks: number; reason?: string };

export type QualifyingCheck = {
  /** NEET: qualifies / borderline (some years) / below. JEE Adv: same idea. */
  status: "qualifies" | "borderline" | "below";
  qualifiedYears: number;
  totalYears: number;
  years: QualifyingYear[];
  /** "Qualifies in 3 of 4 recent years". */
  summary: string;
};

/** One line of "What changed the range" (plan §9.1). */
export type SpreadLine = { label: string; text: string };

export type PredictInput = {
  exam: RankPredictorExam;
  /** Whole-number marks per subject, keyed by the data file's subject ids. */
  marks: Record<string, number>;
  /** Optional wrong answers per subject (tie-break note only, plan §4.5). */
  wrong?: Record<string, number>;
  category: RankCategory;
  pwd: boolean;
  /** One of INDIAN_STATES; only used for NEET state rank. Never stored. */
  homeState?: string | null;
  /** A shift id from the data file (only real 2024 tables exist), or null = "not sure". */
  jeeMainShift?: string | null;
  source?: { kind: SourceKind; resultId?: string };
};

export type Prediction = {
  exam: RankPredictorExam;
  total: number;
  /** The marks actually looked up (widened for mock-based input, plan §4.6). */
  marksUsed: NumberRange;
  /** NEET AIR / JEE Main CRL / JEE Advanced CRL; null when not ranked. */
  air: RankBand | null;
  /** NEET + JEE Main only. */
  percentile: PercentileBand | null;
  categoryRank: RankBand | null;
  pwdRank: RankBand | null;
  stateRank: RankBand | null;
  stateRankStatus: StateRankStatus;
  /** JEE Main only. */
  eligibility: JeeAdvEligibility | null;
  /** NEET qualifying cut-off / JEE Advanced qualification. */
  qualifying: QualifyingCheck | null;
  /** "Top ~20" style text for the very top, never "rank 0". */
  topText: string | null;
  spread: SpreadLine[];
  notes: string[];
  tieBreakNote: string;
  /** Source ids from the data file that this prediction used. */
  sourceIds: string[];
  /** Which past years the numbers came from. */
  years: number[];
};

// ─── Data file shapes (only the fields the engine reads) ─────────────────────

export type Pair = [number, number];

export type DataSource = {
  id: string;
  url: string;
  publisher: string;
  official: boolean;
  fetchedOn: string;
  note?: string;
};

export type SubjectSpec = { id: string; max: number; min: number | null };

export type Expected2027 = { appeared: number; source: string; formula: string };

type ExamFileBase = {
  exam: RankPredictorExam;
  version: number;
  checkedOn: string;
  maxMarks: number;
  subjects: SubjectSpec[];
  tieBreak: string[];
  sources: DataSource[];
  expected2027: Expected2027;
};

export type JeeMainShift = {
  id: string;
  session: number;
  date: string;
  shift: number;
  points: Pair[];
  sourceId?: string;
  quality?: string;
};

export type JeeMainYear = {
  year: number;
  weight: string;
  appeared: number;
  rankTables: Record<string, Pair[]> | null;
  rankTablesSourceId?: string;
  advCutoff: Record<string, number> | null;
  advCutoffSourceId?: string;
  shifts: JeeMainShift[] | null;
  shiftModel?: { quality: string; method?: string; shapeYear?: number; note?: string };
};

export type JeeMainData = ExamFileBase & {
  exam: "jee-main";
  minMarks: number;
  years: JeeMainYear[];
};

export type JeeAdvQualifying = { subjectMin: number; aggregateMin: number };

export type JeeAdvYear = {
  year: number;
  weight: string;
  appeared: number;
  qualified?: number;
  maxMarks: number;
  rankTables: Record<string, Pair[]>;
  rankTablesQuality: string;
  rankTablesSourceId: string;
  qualifying: Record<string, JeeAdvQualifying>;
  qualifyingSourceId?: string;
};

export type JeeAdvancedData = ExamFileBase & {
  exam: "jee-advanced";
  years: JeeAdvYear[];
};

export type NeetCutoff = { minMarks: number; topMarks: number; qualified?: number };

export type NeetShareBucket = { airFrom: number; airTo: number | null; n: number; shares: Record<string, number> };

export type NeetYear = {
  year: number;
  weight: string;
  reason?: string;
  appeared: number;
  qualifyingCutoff: Record<string, NeetCutoff> | null;
  qualifyingCutoffSourceId?: string;
  categoryShareAppeared: { total: number; shares: Record<string, number>; pwdShare: number } | null;
  stateShare: { appearedTotal: number; shares: Record<string, number> } | null;
  categoryShareByAir: NeetShareBucket[] | null;
  categoryShareByAirSourceId?: string;
  marksToAir: Pair[] | null;
  /** 2025 (KEA): [marks, airFirst, airLast]. */
  marksToAirSpread?: [number, number, number][];
  marksToAirQuality?: string;
  marksToAirSourceId?: string;
  notes?: string[];
};

export type NeetStateList = {
  year: number;
  basis: "air" | "marks";
  rows: number;
  points: Pair[];
  sourceId: string;
  list: string;
  quality: string;
};

export type NeetData = ExamFileBase & {
  exam: "neet";
  minMarks: number;
  notes: string[];
  stateLists: Record<string, NeetStateList>;
  years: NeetYear[];
};

export type RankPredictorData = {
  neet: NeetData;
  "jee-main": JeeMainData;
  "jee-advanced": JeeAdvancedData;
};

// ─── Public access (plan §8) ─────────────────────────────────────────────────

/** Free checks a logged-out visitor gets per IST day. */
export const FREE_CHECKS_PER_DAY = 2;

/** `access` in every predictor response: signed in = unlimited (nulls). */
export type Access = { signedIn: boolean; remainingToday: number | null; limit: number | null };
