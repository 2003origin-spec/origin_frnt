/**
 * Pilot evening bonus (pilot readiness item 5, decision B84): the nightly job
 * pays Ori Coins to every verified solver who was online for (nearly) the
 * whole human shift, and — unless the admin switched it off — had put that
 * evening on the weekly roster. Off until the founders set an amount.
 *
 * Paid as a "promo_bonus" transfer from platform:promotions with the key
 * `promo:evening:<day>:<user>`, so each solver is paid at most once per
 * evening however often the job runs, and no schema change was needed.
 * Spendable at once: unlike session earnings there is nothing to refund.
 */

import { getUserPostgresPool } from "@/server/user-postgres";

import { promoBonus } from "./ledger-rules";
import { postTransfers } from "./ledger-store";
import { ensureNowSchema } from "./now-schema";
import { getNowSettings } from "./now-settings";
import { addDays, earnsEveningBonus, istDay, shiftEnd, shiftMinutes, shiftStart, weekdayOf } from "./roster-rules";

/** Evenings looked at on each run, so a missed night is caught up. */
export const BONUS_CATCH_UP_DAYS = 3;

async function db() {
  await ensureNowSchema();
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

export type EveningBonusRun = { enabled: boolean; evenings: string[]; paid: number; coins: number };

export async function payEveningBonuses(now: Date = new Date()): Promise<EveningBonusRun> {
  const { openHours, eveningBonus } = await getNowSettings();
  const run: EveningBonusRun = { enabled: eveningBonus.enabled, evenings: [], paid: 0, coins: 0 };
  const minutes = shiftMinutes(openHours);
  if (!eveningBonus.enabled || minutes <= 0) return run;

  const pool = await db();
  const today = istDay(now.getTime());
  for (let back = BONUS_CATCH_UP_DAYS; back >= 0; back -= 1) {
    const day = addDays(today, -back);
    // Only evenings human hours ran, and only once that shift is over.
    if (!openHours.days.includes(weekdayOf(day)) || shiftEnd(day, openHours) > now) continue;
    run.evenings.push(day);
    const res = await pool.query<{ user_id: string; online: number; rostered: boolean }>(
      `SELECT h.user_id, count(p.minute)::int AS online,
              EXISTS (SELECT 1 FROM now.roster r WHERE r.helper_id = h.id AND r.day = $3::date) AS rostered
         FROM now.helpers h JOIN now.presence_minutes p ON p.helper_id = h.id
        WHERE h.kind = 'human' AND h.verification_status = 'verified' AND h.user_id IS NOT NULL
          AND p.minute >= $1 AND p.minute < $2
        GROUP BY h.id, h.user_id`,
      [shiftStart(day, openHours), shiftEnd(day, openHours), day],
    );
    const earners = res.rows.filter((r) =>
      earnsEveningBonus({
        onlineMinutes: r.online,
        shiftMinutes: minutes,
        rostered: r.rostered,
        minOnlinePercent: eveningBonus.minOnlinePercent,
        requireRoster: eveningBonus.requireRoster,
      }),
    );
    if (earners.length === 0) continue;
    const result = await postTransfers(
      earners.map((r) => promoBonus(r.user_id, eveningBonus.coins, `evening:${day}`, null)),
      { now, note: `Pilot evening bonus for ${day}` },
    );
    run.paid += result.posted.length;
    run.coins += result.posted.length * eveningBonus.coins;
  }
  return run;
}
