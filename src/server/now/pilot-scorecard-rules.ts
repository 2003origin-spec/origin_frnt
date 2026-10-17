/**
 * Pilot scorecard (pilot readiness item 1): the plan doc's pass-or-fail table
 * turned into numbers. Pure rules only — `getPilotScorecard` in
 * admin-insights-service.ts gathers the counts, this file judges them.
 *
 * The pilot is judged only once the sample is big enough: at least 300
 * sessions over at least 10 evenings (plan doc "Pilot", decision B79).
 */

export const SAMPLE_MIN_SESSIONS = 300;
export const SAMPLE_MIN_EVENINGS = 10;

/** Pass lines from the plan doc's pass-or-fail table. */
export const PASS_LINES = {
  connectWithin10: 0.8,
  medianConnectMs: 4 * 60_000,
  acceptRate: 0.6,
  utilisationMin: 0.4,
  utilisationMax: 0.7,
  helperNoShowRate: 0.05,
  resolvedShare: 0.65,
  unresolvedShare: 0.1,
  avgStars: 4.2,
  notSolvedTagShare: 0.1,
  repeatShare: 0.4,
} as const;

export type ScorecardInput = {
  /** Requests made inside human open hours. */
  inHoursRequests: number;
  /** ...of which a human session started within 10 minutes of asking. */
  inHoursHumanWithin10: number;
  /** Ask → human session start, in-hours requests that reached a human. */
  connectTimesMs: readonly number[];
  /** Offers that got an answer or expired. */
  offersClosed: number;
  offersAccepted: number;
  /** Human call minutes (start → end) and solver minutes online. */
  humanCallMinutes: number;
  onlineMinutes: number;
  /** Human sessions accepted, and those where the solver never joined. */
  humanAccepted: number;
  helperNoShows: number;
  outcomes: { resolved: number; partial: number; unresolved: number };
  ratings: number;
  starsTotal: number;
  notSolvedTags: number;
  /** Students whose first request fell in the first half of the period, and how many asked again. */
  firstHalfStudents: number;
  firstHalfReturned: number;
  resolvedDoubts: number;
  botCallMinutes: number;
  upheldChildSafety: number;
  upheldAbuse: number;
  /** Sessions that went live (human + bot), and IST evenings with at least one live human session. */
  liveSessions: number;
  evenings: number;
};

export type RowStatus = "pass" | "fail" | "no_data" | "info";

export type ScorecardRow = {
  key: string;
  label: string;
  /** What the pilot shows, already formatted for the admin table. */
  value: string;
  passLine: string;
  status: RowStatus;
  /** Plain-language note on how the number is counted. */
  note?: string;
};

export type Scorecard = {
  rows: ScorecardRow[];
  sample: { liveSessions: number; evenings: number; ready: boolean };
  /** Every judged row passes and the sample is big enough. */
  passed: boolean;
};

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function ratio(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}

function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 1000) / 10}%`;
}

function judge(value: number | null, ok: (v: number) => boolean): RowStatus {
  if (value === null) return "no_data";
  return ok(value) ? "pass" : "fail";
}

function minutesText(ms: number | null): string {
  if (ms === null) return "—";
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}m ${String(total % 60).padStart(2, "0")}s`;
}

export function evaluateScorecard(input: ScorecardInput): Scorecard {
  const L = PASS_LINES;
  const connect = ratio(input.inHoursHumanWithin10, input.inHoursRequests);
  const medianConnect = median(input.connectTimesMs);
  const accept = ratio(input.offersAccepted, input.offersClosed);
  const utilisation = ratio(input.humanCallMinutes, input.onlineMinutes);
  const noShow = ratio(input.helperNoShows, input.humanAccepted);
  const outcomeTotal = input.outcomes.resolved + input.outcomes.partial + input.outcomes.unresolved;
  const resolved = ratio(input.outcomes.resolved, outcomeTotal);
  const unresolved = ratio(input.outcomes.unresolved, outcomeTotal);
  const avgStars = input.ratings > 0 ? input.starsTotal / input.ratings : null;
  const notSolved = ratio(input.notSolvedTags, input.ratings);
  const repeat = ratio(input.firstHalfReturned, input.firstHalfStudents);

  const rows: ScorecardRow[] = [
    {
      key: "connect_within_10",
      label: "In-hours requests connected to a human within 10 minutes",
      value: `${pct(connect)} (${input.inHoursHumanWithin10} of ${input.inHoursRequests})`,
      passLine: "80% or more",
      status: judge(connect, (v) => v >= L.connectWithin10),
      note: "In-hours uses the open hours set now. The bot never counts as a human connect.",
    },
    {
      key: "median_connect",
      label: "Median request-to-connect time (human)",
      value: minutesText(medianConnect),
      passLine: "Under 4 minutes",
      status: judge(medianConnect, (v) => v < L.medianConnectMs),
    },
    {
      key: "accept_rate",
      label: "Teacher acceptance rate",
      value: `${pct(accept)} (${input.offersAccepted} of ${input.offersClosed} offers)`,
      passLine: "60% or more",
      status: judge(accept, (v) => v >= L.acceptRate),
      note: "Expired offers count as not accepted.",
    },
    {
      key: "utilisation",
      label: "Solver utilisation (minutes in calls ÷ minutes online)",
      value: `${pct(utilisation)} (${Math.round(input.humanCallMinutes)} of ${input.onlineMinutes} min)`,
      passLine: "40% to 70%",
      status: judge(utilisation, (v) => v >= L.utilisationMin && v <= L.utilisationMax),
    },
    {
      key: "helper_no_show",
      label: "Solver no-show rate after accepting",
      value: `${pct(noShow)} (${input.helperNoShows} of ${input.humanAccepted})`,
      passLine: "Under 5%",
      status: judge(noShow, (v) => v < L.helperNoShowRate),
    },
    {
      key: "resolution",
      label: "Resolution (solver-marked)",
      value: `${pct(resolved)} solved · ${pct(unresolved)} not solved (${outcomeTotal} sessions)`,
      passLine: "Solved 65%+, not solved under 10%",
      status:
        resolved === null || unresolved === null
          ? "no_data"
          : resolved >= L.resolvedShare && unresolved < L.unresolvedShare
            ? "pass"
            : "fail",
    },
    {
      key: "rating",
      label: "Average rating and \"Doubt not solved\" tags",
      value: `${avgStars === null ? "—" : avgStars.toFixed(2)}★ · ${pct(notSolved)} not solved (${input.ratings} ratings)`,
      passLine: "4.2+ and under 10%",
      status:
        avgStars === null || notSolved === null
          ? "no_data"
          : avgStars >= L.avgStars && notSolved < L.notSolvedTagShare
            ? "pass"
            : "fail",
    },
    {
      key: "repeat_use",
      label: "Repeat use (first-half students who asked again)",
      value: `${pct(repeat)} (${input.firstHalfReturned} of ${input.firstHalfStudents})`,
      passLine: "40% or more",
      status: judge(repeat, (v) => v >= L.repeatShare),
      note: "Students whose first request in the period falls in its first half.",
    },
    {
      key: "cost_inputs",
      label: "Cost per resolved doubt — inputs",
      value: `${input.resolvedDoubts} resolved · ${Math.round(input.humanCallMinutes)} human call min · ${Math.round(input.botCallMinutes)} bot call min`,
      passLine: "Set by finance",
      status: "info",
      note: "Resolved counts solver-marked human sessions (bot calls record no outcome). Multiply the minutes by LiveKit, Gemini and store costs to get rupees per resolved doubt.",
    },
    {
      key: "safety",
      label: "Upheld child-safety reports",
      value: `${input.upheldChildSafety}${input.upheldAbuse ? ` (plus ${input.upheldAbuse} upheld abuse)` : ""}`,
      passLine: "Zero",
      status: input.upheldChildSafety === 0 ? "pass" : "fail",
    },
  ];

  const ready = input.liveSessions >= SAMPLE_MIN_SESSIONS && input.evenings >= SAMPLE_MIN_EVENINGS;
  const judged = rows.filter((r) => r.status !== "info");
  return {
    rows,
    sample: { liveSessions: input.liveSessions, evenings: input.evenings, ready },
    passed: ready && judged.every((r) => r.status === "pass"),
  };
}

export type RequestFact = { studentId: string; createdAtMs: number };

/**
 * Repeat use: of the students whose first request in the period falls in its
 * first half, how many made at least one more request in the period.
 */
export function repeatUse(requests: readonly RequestFact[], fromMs: number, toMs: number): { students: number; returned: number } {
  const mid = fromMs + (toMs - fromMs) / 2;
  const byStudent = new Map<string, number[]>();
  for (const r of requests) {
    const list = byStudent.get(r.studentId) ?? [];
    list.push(r.createdAtMs);
    byStudent.set(r.studentId, list);
  }
  let students = 0;
  let returned = 0;
  for (const times of byStudent.values()) {
    if (Math.min(...times) >= mid) continue;
    students += 1;
    if (times.length > 1) returned += 1;
  }
  return { students, returned };
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PERIOD_DAYS = 366;

/**
 * The admin picks IST calendar days; `to` is inclusive. Returns null for the
 * default period (no dates given), or an error message for a bad range.
 */
export function parseScorecardPeriod(
  fromKey: string | null,
  toKey: string | null,
): { from: Date; to: Date } | { error: string } | null {
  if (!fromKey && !toKey) return null;
  if (!fromKey || !toKey || !DAY_KEY.test(fromKey) || !DAY_KEY.test(toKey)) {
    return { error: "Give both dates as YYYY-MM-DD." };
  }
  const from = new Date(`${fromKey}T00:00:00+05:30`);
  const to = new Date(new Date(`${toKey}T00:00:00+05:30`).getTime() + 24 * 60 * 60_000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return { error: "Those dates are not valid." };
  if (to <= from) return { error: "The end date must be on or after the start date." };
  if (to.getTime() - from.getTime() > MAX_PERIOD_DAYS * 24 * 60 * 60_000) return { error: "Pick a period of at most a year." };
  return { from, to };
}
