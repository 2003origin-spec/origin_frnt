/**
 * Admin-managed Origin NOW lists: the session price table and the pilot
 * cohort. (Scalar settings live in now-settings.ts.)
 */

import { getUserPostgresPool } from "@/server/user-postgres";

import { ensureNowSchema } from "./now-schema";
import { DEFAULT_PRICE_TABLE, validatePriceTable, type PriceRow } from "./pricing";
import type { Difficulty, SolverKind } from "./types";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

type PriceDbRow = {
  difficulty: Difficulty;
  solver_kind: SolverKind;
  price_coins: number;
  minutes: number;
  extension_minutes: number;
  extension_coins: number;
  max_extensions: number;
};

/**
 * The live price table. Until an admin saves one, the placeholder defaults are
 * returned, so a request never hits a missing price. A partially saved table
 * cannot exist: `savePriceTable` writes all eight rows or none.
 */
export async function loadPriceTable(): Promise<{ rows: PriceRow[]; isDefault: boolean }> {
  await ensureNowSchema();
  const res = await pool().query<PriceDbRow>(
    `SELECT difficulty, solver_kind, price_coins, minutes, extension_minutes, extension_coins, max_extensions FROM now.prices`,
  );
  if (res.rows.length === 0) return { rows: DEFAULT_PRICE_TABLE, isDefault: true };
  return {
    rows: res.rows.map((r) => ({
      difficulty: r.difficulty,
      solverKind: r.solver_kind,
      priceCoins: r.price_coins,
      minutes: r.minutes,
      extensionMinutes: r.extension_minutes,
      extensionCoins: r.extension_coins,
      maxExtensions: r.max_extensions,
    })),
    isDefault: false,
  };
}

export async function savePriceTable(rows: readonly PriceRow[], adminId: string): Promise<void> {
  const errors = validatePriceTable(rows);
  if (errors.length) throw Object.assign(new Error(errors.join(" ")), { status: 400 });
  await ensureNowSchema();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    for (const r of rows) {
      await client.query(
        `INSERT INTO now.prices (difficulty, solver_kind, price_coins, minutes, extension_minutes, extension_coins, max_extensions, updated_by, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (difficulty, solver_kind) DO UPDATE SET
           price_coins = EXCLUDED.price_coins, minutes = EXCLUDED.minutes,
           extension_minutes = EXCLUDED.extension_minutes, extension_coins = EXCLUDED.extension_coins,
           max_extensions = EXCLUDED.max_extensions, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
        [r.difficulty, r.solverKind, r.priceCoins, r.minutes, r.extensionMinutes, r.extensionCoins, r.maxExtensions, adminId],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export type CohortMember = {
  userId: string;
  name: string | null;
  email: string | null;
  invitedAt: string;
  removedAt: string | null;
};

export async function listCohort(): Promise<CohortMember[]> {
  await ensureNowSchema();
  const res = await pool().query<{ user_id: string; name: string | null; email: string | null; invited_at: Date; removed_at: Date | null }>(
    `SELECT c.user_id, u.name, u.email, c.invited_at, c.removed_at
       FROM now.pilot_cohort c JOIN origin_users u ON u.id = c.user_id
      ORDER BY c.removed_at NULLS FIRST, c.invited_at DESC`,
  );
  return res.rows.map((r) => ({
    userId: r.user_id,
    name: r.name,
    email: r.email,
    invitedAt: r.invited_at.toISOString(),
    removedAt: r.removed_at ? r.removed_at.toISOString() : null,
  }));
}

/** Invites by user id or email; returns what was invited and what was not found. */
export async function inviteToCohort(
  identifiers: readonly string[],
  adminId: string,
): Promise<{ invited: string[]; notFound: string[] }> {
  await ensureNowSchema();
  const cleaned = [...new Set(identifiers.map((s) => s.trim()).filter(Boolean))].slice(0, 1000);
  if (cleaned.length === 0) return { invited: [], notFound: [] };
  const found = await pool().query<{ id: string; email: string | null }>(
    `SELECT id, email FROM origin_users WHERE id = ANY($1::text[]) OR lower(email) = ANY($2::text[])`,
    [cleaned, cleaned.map((s) => s.toLowerCase())],
  );
  const matched = new Set<string>();
  for (const row of found.rows) {
    matched.add(row.id);
    if (row.email) matched.add(row.email.toLowerCase());
  }
  const ids = found.rows.map((r) => r.id);
  if (ids.length) {
    await pool().query(
      `INSERT INTO now.pilot_cohort (user_id, invited_by)
       SELECT unnest($1::text[]), $2
       ON CONFLICT (user_id) DO UPDATE SET removed_at = NULL, invited_by = EXCLUDED.invited_by, invited_at = NOW()`,
      [ids, adminId],
    );
  }
  return {
    invited: ids,
    notFound: cleaned.filter((s) => !matched.has(s) && !matched.has(s.toLowerCase())),
  };
}

export async function removeFromCohort(userId: string): Promise<void> {
  await ensureNowSchema();
  await pool().query(`UPDATE now.pilot_cohort SET removed_at = NOW() WHERE user_id = $1 AND removed_at IS NULL`, [userId]);
}
