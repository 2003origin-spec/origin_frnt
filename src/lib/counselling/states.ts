/**
 * State names for the counselling tool. One spelling everywhere: the
 * INDIAN_STATES list the sign-up form and the Rank Predictor already use.
 * Pure, client-safe.
 */

import { INDIAN_STATES } from "@/lib/constants";

export const INDIAN_STATE_NAMES: readonly string[] = INDIAN_STATES;

/** "TAMIL NADU" / "Delhi (NCT)" / "Daman & Diu (UT)" → the INDIAN_STATES spelling, or the input trimmed. */
export function canonicalState(value: string): string {
  const key = value
    .toUpperCase()
    .replace(/&/gu, "AND")
    .replace(/\((UT|NCT)\)/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
  if (key === "DADRA AND NAGAR HAVELI" || key === "DAMAN AND DIU") return "Dadra and Nagar Haveli and Daman and Diu";
  if (key === "ORISSA") return "Odisha";
  if (key === "PONDICHERRY") return "Puducherry";
  if (key === "JAMMU AND KASHMIR UT" || key === "JAMMU AND KASHMIR") return "Jammu and Kashmir";
  const hit = INDIAN_STATE_NAMES.find((s) => s.toUpperCase() === key);
  return hit ?? value.trim();
}

export function isIndianStateName(value: unknown): value is string {
  return typeof value === "string" && INDIAN_STATE_NAMES.includes(value);
}

/** Bodies whose state list covers this home state (NEET state quota). */
export const STATE_BODY_BY_STATE: Readonly<Record<string, string>> = Object.freeze({
  Karnataka: "state_ka",
  "Tamil Nadu": "state_tn",
  "Uttar Pradesh": "state_up",
  Maharashtra: "state_mh",
  Rajasthan: "state_rj",
  Gujarat: "state_gj",
  "Madhya Pradesh": "state_mp",
  Bihar: "state_br",
  Odisha: "state_od",
});
