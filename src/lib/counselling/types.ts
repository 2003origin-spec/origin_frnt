/**
 * College counselling tool — shared types (plan V1/PERCENTILE_PREDICTOR_PLAN.md
 * §6.2, §7.3, §11). Pure: imported by the import script, the server and the
 * browser (types only on the browser side).
 */

/** Counselling bodies in the clean CSVs (`body` column). */
export const COUNSELLING_BODIES = [
  "josaa",
  "csab_special",
  "csab_neut",
  "mcc_ug",
  "state_ka",
  "state_tn",
  "state_up",
  "state_mh",
  "state_rj",
  "state_gj",
  "state_mp",
  "state_br",
  "state_od",
] as const;
export type CounsellingBody = (typeof COUNSELLING_BODIES)[number];

export const JEE_BODIES = ["josaa", "csab_special", "csab_neut"] as const satisfies readonly CounsellingBody[];
export const NEET_BODIES = [
  "mcc_ug",
  "state_ka",
  "state_tn",
  "state_up",
  "state_mh",
  "state_rj",
  "state_gj",
  "state_mp",
  "state_br",
  "state_od",
] as const satisfies readonly CounsellingBody[];

export type CounsellingExam = "jee" | "neet";

export const RANK_BASES = ["jee_adv", "jee_main", "neet_air", "state_rank"] as const;
export type RankBasis = (typeof RANK_BASES)[number];

export const DERIVED_KINDS = ["official", "from_allotments", "joined_merit_list"] as const;
export type DerivedKind = (typeof DERIVED_KINDS)[number];

export type Gender = "neutral" | "female";

/** The student's category (same ids as the Rank Predictor). */
export const COUNSELLING_CATEGORIES = ["general", "ews", "obc-ncl", "sc", "st"] as const;
export type CounsellingCategory = (typeof COUNSELLING_CATEGORIES)[number];

/** Institute types shown in the filter. */
export const INSTITUTE_TYPES = [
  "IIT",
  "IISC",
  "NIT",
  "IIIT",
  "GFTI",
  "AIIMS",
  "JIPMER",
  "ESIC",
  "MED_CENTRAL",
  "MED_DEEMED",
  "MED_GOVT",
  "STATE",
] as const;
export type InstituteType = (typeof INSTITUTE_TYPES)[number];

/** One validated row of a clean counselling CSV. */
export type CutoffRow = {
  body: CounsellingBody;
  year: number;
  round: number;
  roundLabel: string;
  isFinal: boolean;
  institute: string;
  program: string;
  quota: string;
  seatType: string;
  pwd: boolean;
  gender: Gender;
  rankBasis: RankBasis;
  openingRank: number | null;
  closingRank: number;
  openingPrep: boolean;
  closingPrep: boolean;
  seats: number | null;
  precisionLost: boolean;
  derived: DerivedKind;
};

/** Safe / Likely / Reach (plan §11.3). */
export type ChanceBand = "safe" | "likely" | "reach";
export const CHANCE_BANDS: readonly ChanceBand[] = ["safe", "likely", "reach"];

/** A rank the student typed, or the predictor's range (low = better rank). */
export type RankRange = { low: number; high: number };

export type CounsellingRanks = {
  jeeAdvCrl?: RankRange;
  jeeAdvCategory?: RankRange;
  jeeAdvPwdCrl?: RankRange;
  jeeAdvPwdCategory?: RankRange;
  jeeMainCrl?: RankRange;
  jeeMainCategory?: RankRange;
  jeeMainPwdCrl?: RankRange;
  jeeMainPwdCategory?: RankRange;
  neetAir?: RankRange;
  /** Tamil Nadu's own state merit rank (the TN list is on that basis). */
  neetTnStateRank?: RankRange;
};

export type CounsellingSort = "competitive" | "closest";

export type CounsellingFilters = {
  bodies: CounsellingBody[];
  years: number[];
  instituteTypes: InstituteType[];
  states: string[];
  branchQuery: string;
  roundMode: "final" | "each";
  band: ChanceBand | "all";
  sort: CounsellingSort;
};

export type CounsellingSearchInput = {
  exam: CounsellingExam;
  ranks: CounsellingRanks;
  category: CounsellingCategory;
  pwd: boolean;
  gender: "male" | "female" | "other";
  homeState: string;
  filters: CounsellingFilters;
  page: number;
  pageSize: number;
};

/** One round's closing rank for a seat cell. */
export type RoundClosing = {
  round: number;
  label: string;
  closing: number;
  closingPrep: boolean;
  opening: number | null;
};

/** A seat cell as the server reads it (one row per round). */
export type CellRound = {
  cellKey: string;
  body: CounsellingBody;
  year: number;
  round: number;
  roundLabel: string;
  isFinal: boolean;
  instituteId: number;
  institute: string;
  instituteType: string;
  instituteState: string | null;
  homeStates: string[];
  programId: number;
  program: string;
  quota: string;
  seatType: string;
  pwd: boolean;
  gender: Gender;
  rankBasis: RankBasis;
  openingRank: number | null;
  closingRank: number;
  openingPrep: boolean;
  closingPrep: boolean;
  seats: number | null;
  precisionLost: boolean;
  derived: DerivedKind;
};

/** One result row (one seat cell, one year). */
export type CounsellingResultRow = {
  key: string;
  band: ChanceBand;
  body: CounsellingBody;
  year: number;
  institute: string;
  instituteType: string;
  state: string | null;
  program: string;
  quota: string;
  quotaLabel: string;
  seatType: string;
  pwd: boolean;
  femaleOnly: boolean;
  rankBasis: RankBasis;
  /** Which of the student's ranks was compared (e.g. "JEE Main category rank"). */
  rankUsedLabel: string;
  /** Middle of the range (the number "Likely" compares). */
  rankUsed: number;
  /** The student's range for this rank (low = high when typed). */
  rankUsedRange: RankRange;
  finalClosing: number;
  finalClosingPrep: boolean;
  rounds: RoundClosing[];
  /** First round whose closing rank reached the student's rank, or null. */
  openedInRound: { round: number; label: string } | null;
  derived: DerivedKind;
  precisionLost: boolean;
  notes: string[];
  trend: string | null;
  expectedNextYear: string | null;
};
