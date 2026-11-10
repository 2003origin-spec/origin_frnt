/**
 * Home-state handling for NEET state rank. Only the 9 states with a real
 * official list in neet.json get a number; every other state answers
 * "not available" (no proportional guess in the product — owner decision,
 * Stage 2 brief). Client-safe.
 */

import { INDIAN_STATES } from "@/lib/constants";

/** INDIAN_STATES name → neet.json stateLists code. */
export const NEET_STATE_LIST_CODE: Readonly<Record<string, string>> = Object.freeze({
  Karnataka: "KA",
  "Tamil Nadu": "TN",
  "Uttar Pradesh": "UP",
  Rajasthan: "RJ",
  Gujarat: "GJ",
  "Madhya Pradesh": "MP",
  Maharashtra: "MH",
  Bihar: "BR",
  Odisha: "OD",
});

export const NEET_STATES_WITH_LIST: readonly string[] = Object.freeze(Object.keys(NEET_STATE_LIST_CODE));

export function isIndianState(value: unknown): value is string {
  return typeof value === "string" && (INDIAN_STATES as readonly string[]).includes(value);
}

/**
 * INDIAN_STATES spells a few names differently from NTA's state-wise table
 * (stateShare keys). Used only by the documented proportional method.
 */
const NTA_STATE_NAME: Readonly<Record<string, string>> = Object.freeze({
  "Andaman and Nicobar Islands": "Andaman & Nicobar Islands",
});

export function ntaStateName(state: string): string {
  return NTA_STATE_NAME[state] ?? state;
}
