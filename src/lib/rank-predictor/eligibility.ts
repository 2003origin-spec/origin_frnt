/**
 * Cut-off checks: JEE Main → JEE Advanced eligibility (plan §4.2 step 7),
 * JEE Advanced qualification (§4.4 step 1) and the NEET qualifying cut-off
 * (§4.3 step 6). Pure.
 */

import type {
  EligibilityStatus,
  JeeAdvEligibility,
  JeeAdvYear,
  JeeMainData,
  NeetYear,
  NumberRange,
  QualifyingCheck,
  QualifyingYear,
  RankCategory,
} from "./types";

/** Percentile band vs one cut-off. Borderline when the band straddles it. */
export function eligibilityStatus(band: NumberRange, cutoff: number): EligibilityStatus {
  if (band.low >= cutoff) return "likely";
  if (band.high < cutoff) return "not_eligible";
  return "borderline";
}

const JEE_MAIN_CUTOFF_KEY: Record<RankCategory, string> = {
  general: "UR",
  ews: "EWS",
  "obc-ncl": "OBC-NCL",
  sc: "SC",
  st: "ST",
};

export function jeeMainCutoffKey(category: RankCategory, pwd: boolean): string {
  return pwd ? "UR-PwD" : JEE_MAIN_CUTOFF_KEY[category];
}

/** Eligibility against the latest year that has cut-offs. Null when none does. */
export function jeeAdvEligibility(
  data: JeeMainData,
  band: NumberRange,
  category: RankCategory,
  pwd: boolean,
): JeeAdvEligibility | null {
  const key = jeeMainCutoffKey(category, pwd);
  const years = [...data.years].sort((a, b) => b.year - a.year);
  for (const year of years) {
    const cutoff = year.advCutoff?.[key];
    if (typeof cutoff === "number") {
      return { status: eligibilityStatus(band, cutoff), year: year.year, cutoff, cutoffKey: key };
    }
  }
  return null;
}

// ─── JEE Advanced ────────────────────────────────────────────────────────────

const ADV_LIST_KEY: Record<RankCategory, string> = {
  general: "CRL",
  ews: "GEN-EWS",
  "obc-ncl": "OBC-NCL",
  sc: "SC",
  st: "ST",
};

/** The JEE Advanced list a candidate is ranked in (and qualifies for). */
export function jeeAdvListKey(category: RankCategory, pwd: boolean): string {
  const base = ADV_LIST_KEY[category];
  return pwd ? `${base}-PwD` : base;
}

/** Does this mark sheet make list `key` in `year`? Null when the year has no cut-off for it. */
export function jeeAdvQualifiesFor(
  year: JeeAdvYear,
  key: string,
  subjectMarks: readonly number[],
  total: number,
): QualifyingYear | null {
  const q = year.qualifying[key];
  if (!q) return null;
  const subjectOk = subjectMarks.every((m) => m >= q.subjectMin);
  const totalOk = total >= q.aggregateMin;
  let reason: string | undefined;
  if (!subjectOk) reason = `needs at least ${q.subjectMin} in every subject`;
  else if (!totalOk) reason = `needs at least ${q.aggregateMin} in total`;
  return { year: year.year, qualifies: subjectOk && totalOk, minMarks: q.aggregateMin, reason };
}

export function summariseQualifying(years: QualifyingYear[], verb: string): QualifyingCheck {
  const sorted = [...years].sort((a, b) => a.year - b.year);
  const qualifiedYears = sorted.filter((y) => y.qualifies).length;
  const totalYears = sorted.length;
  const status = qualifiedYears === totalYears ? "qualifies" : qualifiedYears === 0 ? "below" : "borderline";
  const summary =
    status === "below"
      ? `Below the qualifying cut-off in recent years (${totalYears} of ${totalYears})`
      : `${verb} in ${qualifiedYears} of ${totalYears} recent years`;
  return { status, qualifiedYears, totalYears, years: sorted, summary };
}

export function jeeAdvQualification(
  years: readonly JeeAdvYear[],
  category: RankCategory,
  pwd: boolean,
  subjectMarks: readonly number[],
  total: number,
): QualifyingCheck | null {
  const key = jeeAdvListKey(category, pwd);
  const rows = years
    .map((year) => jeeAdvQualifiesFor(year, key, subjectMarks, total))
    .filter((row): row is QualifyingYear => row !== null);
  return rows.length ? summariseQualifying(rows, "Qualifies") : null;
}

// ─── NEET ────────────────────────────────────────────────────────────────────

const NEET_CUTOFF_KEY: Record<RankCategory, string> = {
  general: "UR/EWS",
  ews: "UR/EWS",
  "obc-ncl": "OBC",
  sc: "SC",
  st: "ST",
};

export function neetCutoffKey(category: RankCategory, pwd: boolean): string {
  const base = NEET_CUTOFF_KEY[category];
  return pwd ? `${base} & PwBD` : base;
}

/** NEET total vs each normal-weight year's qualifying cut-off (2024 is left out). */
export function neetQualifying(
  years: readonly NeetYear[],
  category: RankCategory,
  pwd: boolean,
  total: number,
): QualifyingCheck | null {
  const key = neetCutoffKey(category, pwd);
  const rows: QualifyingYear[] = [];
  for (const year of years) {
    if (year.weight !== "normal") continue;
    const cutoff = year.qualifyingCutoff?.[key];
    if (!cutoff) continue;
    rows.push({ year: year.year, qualifies: total >= cutoff.minMarks, minMarks: cutoff.minMarks });
  }
  return rows.length ? summariseQualifying(rows, "Above the qualifying cut-off") : null;
}
