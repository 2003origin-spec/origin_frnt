/**
 * Display text for the college finder (plan §11.4, §12.2). Client-safe.
 */

import type { ChanceBand, CounsellingBody, CounsellingCategory, InstituteType } from "./types";

export const BODY_LABEL: Record<CounsellingBody, string> = {
  josaa: "JoSAA",
  csab_special: "CSAB special rounds",
  csab_neut: "CSAB NEUT (North-East & UT seats)",
  mcc_ug: "MCC All India Quota",
  state_ka: "Karnataka state quota",
  state_tn: "Tamil Nadu state quota",
  state_up: "Uttar Pradesh state quota",
  state_mh: "Maharashtra state quota",
  state_rj: "Rajasthan state quota",
  state_gj: "Gujarat state quota",
  state_mp: "Madhya Pradesh state quota",
  state_br: "Bihar state quota",
  state_od: "Odisha state quota",
};

/** Known gaps, shown next to the body (DATA_NOTES "Counselling — states"). */
export const BODY_DATA_NOTE: Partial<Record<CounsellingBody, string>> = {
  state_ka: "Partial: only the 2025 round 2 provisional MBBS list; colleges show as KEA codes until KEA's name list is added.",
  state_tn: "Partial: one late 2026 government-quota list only; ranks are Tamil Nadu state ranks.",
  state_mp: "Round 1 was not published; round 2 and mop-up only.",
  state_gj: "Colleges show by the short names Gujarat uses.",
  state_od: "Final admitted list only (no round-wise data).",
  csab_special: "2025: only the last special round is in our data.",
};

export const BAND_LABEL: Record<ChanceBand, string> = { safe: "Safe", likely: "Likely", reach: "Reach" };

export const BAND_HINT: Record<ChanceBand, string> = {
  safe: "Your rank was well inside round 1's closing rank.",
  likely: "Your rank was inside the last round's closing rank.",
  reach: "Just outside the last closing rank (within 15%). Possible if ranks move your way.",
};

export const INSTITUTE_TYPE_LABEL: Record<InstituteType, string> = {
  IIT: "IIT",
  IISC: "IISc",
  NIT: "NIT / IIEST",
  IIIT: "IIIT",
  GFTI: "Other govt-funded (GFTI)",
  AIIMS: "AIIMS",
  JIPMER: "JIPMER",
  ESIC: "ESIC",
  MED_CENTRAL: "Central / DU / BHU / AMU",
  MED_DEEMED: "Deemed university",
  MED_GOVT: "Govt medical (15% AIQ)",
  STATE: "State quota college",
};

export const JEE_INSTITUTE_TYPES: readonly InstituteType[] = ["IIT", "IISC", "NIT", "IIIT", "GFTI"];
export const NEET_INSTITUTE_TYPES: readonly InstituteType[] = ["AIIMS", "JIPMER", "MED_GOVT", "ESIC", "MED_CENTRAL", "MED_DEEMED", "STATE"];

export const CATEGORY_SEAT_LABEL: Record<CounsellingCategory, string> = {
  general: "General (OPEN)",
  ews: "EWS",
  "obc-ncl": "OBC-NCL",
  sc: "SC",
  st: "ST",
};

export const COUNSELLING_DISCLAIMER =
  "Based on last year's closing ranks; this year will differ. This is guidance, not a promise of a seat. Always check the official JoSAA / CSAB / MCC / state counselling site before choice filling.";

export const OFFICIAL_LINKS: readonly { label: string; url: string; exam: "jee" | "neet" }[] = [
  { label: "JoSAA", url: "https://josaa.nic.in/", exam: "jee" },
  { label: "CSAB", url: "https://csab.nic.in/", exam: "jee" },
  { label: "MCC (NEET UG)", url: "https://mcc.nic.in/ug-medical-counselling/", exam: "neet" },
];

const NUMBER = new Intl.NumberFormat("en-IN");

export function formatRank(n: number, prep = false): string {
  return `${NUMBER.format(n)}${prep ? " P" : ""}`;
}
