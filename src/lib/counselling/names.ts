/**
 * Institute / program names for the counselling import (plan §6.2). Pure.
 *
 * MCC allotment PDFs print "Name, City,ADDRESS…" in one cell and the Stage 1
 * parser kept the whole cell, sometimes with words from the next column
 * ("Seat", "Insurance") and the page footer ("Page No. 12 24-08-2026 …").
 * One college therefore appears under several strings, which would split its
 * seat cells. `mccInstituteName` keeps only the name part so those strings
 * group back into one college (DATA_NOTES "Counselling — MCC").
 */

import josaa from "./josaa-institutes.json";
import { INDIAN_STATE_NAMES, canonicalState } from "./states";
import type { CounsellingBody, InstituteType } from "./types";

type JosaaInstitute = { name: string; type: string; state: string | null; homeStates: string[] };

const JOSAA_LIST = (josaa as { institutes: JosaaInstitute[] }).institutes;

/** Lower-case, single-spaced, without punctuation: the join key for names. */
export function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/gu, " and ")
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

const JOSAA_BY_KEY = new Map(JOSAA_LIST.map((i) => [nameKey(i.name), i]));

const BLEED_WORDS = /\b(Seat|Insurance|Scheme\(ESI\)|Quota)\b/giu;
const GENERIC_WORDS = new Set(["government", "govt", "medical", "dental", "college", "and", "hospital", "hosp", "esic"]);

function collapse(s: string): string {
  return s.replace(/\s+/gu, " ").trim();
}

/** "AIIMS, Raipur,Tatibandh, G E Road … Page No. 47 24-08-2026 09:52:36 AM" → "AIIMS, Raipur". */
export function mccInstituteName(raw: string): string {
  let s = raw.replace(/\s*Page No\.[\s\S]*$/u, "").replace(/^-Puducherry(?=\S)/u, "");
  // Name and address are joined by a comma WITHOUT a following space.
  const cut = /,(?=\S)/u.exec(s);
  const head = cut ? s.slice(0, cut.index) : s;
  const rest = cut ? s.slice(cut.index + 1) : "";
  s = collapse(head.replace(BLEED_WORDS, " ")).replace(/[\s,]+$/u, "");
  // "GOVT. MEDICAL COLLEGE,PATIALA…": a bare generic name keeps its city.
  const words = nameKey(s).split(" ").filter(Boolean);
  if (!s.includes(",") && words.length > 0 && words.every((w) => GENERIC_WORDS.has(w))) {
    const city = collapse((rest.split(",")[0] ?? "").replace(BLEED_WORDS, " "));
    if (city && city.length <= 40 && !/\d/u.test(city)) s = `${s}, ${city}`;
  }
  return s || collapse(raw);
}

/** The display name stored for an institute of this body. */
export function instituteDisplayName(body: CounsellingBody, raw: string): string {
  if (body === "mcc_ug") return mccInstituteName(raw);
  return collapse(raw).replace(/[\s,]+$/u, "");
}

/** The institute "group": JoSAA and CSAB share one list of institutes. */
export function instituteGroup(body: CounsellingBody): string {
  return body === "josaa" || body === "csab_special" || body === "csab_neut" ? "josaa" : body;
}

function jeeTypeFromName(name: string): InstituteType {
  if (/^Indian Institute of Science\b/iu.test(name)) return "IISC";
  if (/^Indian Institute\s+of\s+Technology\b/iu.test(name) && !/Information Technology/iu.test(name)) return "IIT";
  if (/Indian Institute of Information Technology|\bIIIT\b/iu.test(name)) return "IIIT";
  if (/National Institute of Technology|Indian Institute of Engineering Science and Technology/iu.test(name)) return "NIT";
  return "GFTI";
}

/** First Indian state or UT named in the text (whole-word), or null. */
export function stateInText(text: string): string | null {
  const t = ` ${nameKey(text)} `;
  // Longest names first so "Dadra and Nagar Haveli…" beats nothing shorter by mistake.
  for (const state of [...INDIAN_STATE_NAMES].sort((a, b) => b.length - a.length)) {
    if (t.includes(` ${nameKey(state)} `)) return state;
  }
  const aliases: [RegExp, string][] = [
    [/\btamilnadu\b/u, "Tamil Nadu"],
    [/\bchattisgarh\b/u, "Chhattisgarh"],
    [/\borissa\b/u, "Odisha"],
    [/\bpondicherry\b/u, "Puducherry"],
    [/\bnew delhi\b/u, "Delhi"],
    [/\bkashmir\b/u, "Jammu and Kashmir"],
    [/\bmumbai\b|\bpune\b|\bnagpur\b/u, "Maharashtra"],
    [/\bchennai\b|\bmadurai\b|\bcoimbatore\b/u, "Tamil Nadu"],
    [/\bbangalore\b|\bbengaluru\b|\bmangalore\b|\bmangaluru\b|\bmysore\b|\bmanipal\b/u, "Karnataka"],
    [/\bkolkata\b/u, "West Bengal"],
    [/\bhyderabad\b/u, "Telangana"],
    [/\blucknow\b|\bvaranasi\b|\baligarh\b|\bnoida\b/u, "Uttar Pradesh"],
    [/\bjaipur\b|\budaipur\b|\bjodhpur\b/u, "Rajasthan"],
    [/\bahmedabad\b|\bsurat\b|\bvadodara\b/u, "Gujarat"],
    [/\bbhopal\b|\bindore\b|\bgwalior\b/u, "Madhya Pradesh"],
    [/\bpatna\b/u, "Bihar"],
    [/\bfaridabad\b|\bgurugram\b|\brohtak\b/u, "Haryana"],
  ];
  for (const [re, state] of aliases) if (re.test(t)) return state;
  return null;
}

const STATE_OF_BODY: Partial<Record<CounsellingBody, string>> = {
  state_ka: "Karnataka",
  state_tn: "Tamil Nadu",
  state_up: "Uttar Pradesh",
  state_mh: "Maharashtra",
  state_rj: "Rajasthan",
  state_gj: "Gujarat",
  state_mp: "Madhya Pradesh",
  state_br: "Bihar",
  state_od: "Odisha",
};

export function stateOfBody(body: CounsellingBody): string | null {
  return STATE_OF_BODY[body] ?? null;
}

export type InstituteInfo = { type: InstituteType; state: string | null; homeStates: string[] };

const DEEMED_QUOTAS = /Deemed\/Paid|Self-Financed Merit/iu;
const CENTRAL_QUOTAS = /Open Seat Quota|Delhi University|IP University|AMU|Aligarh|Jamia|BHU|Banaras/iu;

/**
 * Type, state and home states for an institute. `rawNames` are every raw
 * string the institute appeared under (MCC addresses help find the state);
 * `quotas` the quotas its seats were in (MCC: deemed / central university).
 */
export function instituteInfo(body: CounsellingBody, name: string, rawNames: readonly string[], quotas: readonly string[]): InstituteInfo {
  const group = instituteGroup(body);
  if (group === "josaa") {
    const known = JOSAA_BY_KEY.get(nameKey(name));
    const type = /^Indian Institute of Science\b/iu.test(name) ? "IISC" : ((known?.type as InstituteType | undefined) ?? jeeTypeFromName(name));
    const state = known?.state ?? stateInText(rawNames.join(" ")) ?? stateInText(name);
    return { type, state: state ? canonicalState(state) : null, homeStates: known?.homeStates ?? [] };
  }
  if (body === "mcc_ug") {
    const all = `${name} ${rawNames.join(" ")}`;
    let type: InstituteType = "MED_GOVT";
    if (/\bAIIMS\b|All India Institute of Medical/iu.test(name)) type = "AIIMS";
    else if (/JIPMER/iu.test(name)) type = "JIPMER";
    else if (/\bESIC?\b|Employees State Insurance/iu.test(name)) type = "ESIC";
    else if (quotas.some((q) => DEEMED_QUOTAS.test(q))) type = "MED_DEEMED";
    else if (quotas.some((q) => CENTRAL_QUOTAS.test(q))) type = "MED_CENTRAL";
    return { type, state: stateInText(all), homeStates: [] };
  }
  const state = stateOfBody(body);
  return { type: "STATE", state, homeStates: state ? [state] : [] };
}

/** "Computer Science and Engineering (4 Years, Bachelor of Technology)" → parts. */
export function programParts(program: string): { name: string; degree: string | null; durationYears: number | null } {
  const m = /^(.*?)\s*\((\d)\s*Years?,\s*([^)]+)\)\s*$/iu.exec(program.trim());
  if (!m) return { name: collapse(program), degree: null, durationYears: null };
  return { name: collapse(program), degree: collapse(m[3]), durationYears: Number(m[2]) };
}

/** Short program label for the UI: the part before " (4 Years, …)". */
export function shortProgram(program: string): string {
  const m = /^(.*?)\s*\(\d\s*Years?,/iu.exec(program);
  return collapse(m ? m[1] : program);
}
