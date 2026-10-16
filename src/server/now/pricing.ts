/**
 * Session pricing and timing for Origin NOW, keyed by question difficulty and
 * solver kind. Every number here is an admin setting (`now.prices`); the
 * defaults below exist only so a fresh dev database works before an admin has
 * saved a table, and are PLACEHOLDERS until founder sign-off (plan doc,
 * "What we need from you", item 2).
 */

import { DIFFICULTIES, SOLVER_KINDS, type Difficulty, type SolverKind } from "./types";

export type PriceRow = {
  difficulty: Difficulty;
  solverKind: SolverKind;
  priceCoins: number;
  minutes: number;
  extensionMinutes: number;
  extensionCoins: number;
  maxExtensions: number;
};

const PLACEHOLDER_HUMAN: Record<Difficulty, Pick<PriceRow, "priceCoins" | "minutes">> = {
  easy: { priceCoins: 40, minutes: 4 },
  medium: { priceCoins: 60, minutes: 5 },
  hard: { priceCoins: 90, minutes: 5 },
  insane: { priceCoins: 120, minutes: 5 },
};

/** Dev/bootstrap table: bot priced the same as a human (founder default). */
export const DEFAULT_PRICE_TABLE: PriceRow[] = SOLVER_KINDS.flatMap((solverKind) =>
  DIFFICULTIES.map((difficulty) => ({
    difficulty,
    solverKind,
    ...PLACEHOLDER_HUMAN[difficulty],
    extensionMinutes: 2,
    extensionCoins: Math.ceil(PLACEHOLDER_HUMAN[difficulty].priceCoins / 2),
    maxExtensions: 2,
  })),
);

export function lookupPrice(
  table: readonly PriceRow[],
  difficulty: Difficulty,
  solverKind: SolverKind,
): PriceRow | null {
  return table.find((row) => row.difficulty === difficulty && row.solverKind === solverKind) ?? null;
}

function isWholeNumber(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

/**
 * Validates a full admin price table. It must cover every difficulty for both
 * solver kinds, so a request can never hit a missing price at runtime.
 */
export function validatePriceTable(rows: readonly PriceRow[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const key = `${row.difficulty}:${row.solverKind}`;
    if (seen.has(key)) errors.push(`Duplicate price row for ${key}.`);
    seen.add(key);
    if (!isWholeNumber(row.priceCoins, 1, 1_000_000)) errors.push(`${key}: price must be a whole number of coins above 0.`);
    if (!isWholeNumber(row.minutes, 1, 60)) errors.push(`${key}: session length must be 1 to 60 minutes.`);
    if (!isWholeNumber(row.extensionMinutes, 1, 30)) errors.push(`${key}: extension must be 1 to 30 minutes.`);
    if (!isWholeNumber(row.extensionCoins, 0, 1_000_000)) errors.push(`${key}: extension price must be a whole number of coins.`);
    if (!isWholeNumber(row.maxExtensions, 0, 10)) errors.push(`${key}: maximum extensions must be 0 to 10.`);
  }
  for (const solverKind of SOLVER_KINDS) {
    for (const difficulty of DIFFICULTIES) {
      if (!seen.has(`${difficulty}:${solverKind}`)) errors.push(`Missing price for ${difficulty}:${solverKind}.`);
    }
  }
  return errors;
}

/** Basis points: 100 bps = 1%. Origin's cut is rounded down so the solver never loses a coin to rounding. */
export function splitSessionPrice(priceCoins: number, commissionBps: number): { solver: number; platform: number } {
  if (!Number.isInteger(priceCoins) || priceCoins < 0) throw new Error("priceCoins must be a non-negative integer");
  if (!Number.isInteger(commissionBps) || commissionBps < 0 || commissionBps > 10_000) {
    throw new Error("commissionBps must be an integer between 0 and 10000");
  }
  const platform = Math.floor((priceCoins * commissionBps) / 10_000);
  return { solver: priceCoins - platform, platform };
}

/** Minutes a live session runs before the server ends it. */
export function sessionLengthMinutes(row: PriceRow, extensionsUsed: number): number {
  return row.minutes + row.extensionMinutes * Math.max(0, extensionsUsed);
}

export type ExtensionCheck =
  | { ok: true; coins: number; minutes: number }
  | { ok: false; reason: "max_reached" | "insufficient_coins" };

export function checkExtension(row: PriceRow, extensionsUsed: number, availableCoins: number): ExtensionCheck {
  if (extensionsUsed >= row.maxExtensions) return { ok: false, reason: "max_reached" };
  if (availableCoins < row.extensionCoins) return { ok: false, reason: "insufficient_coins" };
  return { ok: true, coins: row.extensionCoins, minutes: row.extensionMinutes };
}

/**
 * When a request falls back to the bot at a different price, the hold is moved
 * by the difference. Positive = the student must cover more (needs consent and
 * balance); negative = the excess goes back to them.
 */
export function holdAdjustmentForFallback(heldCoins: number, botPriceCoins: number): number {
  return botPriceCoins - heldCoins;
}
