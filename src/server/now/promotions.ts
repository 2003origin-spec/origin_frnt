/**
 * Coin-pack promotion bonus (plan doc, "Promotions"). Pure: the store loads
 * active promotions, this picks the single best one. Promotions never stack,
 * so a student can always predict the bonus from the banner they saw.
 */

export type PromotionRow = {
  id: string;
  kind: "percent_on_pack" | "flat_grant";
  value: number;
  audience: "all" | "cohort" | "pack_buyers";
  packId: string | null;
  startsAt: Date;
  endsAt: Date;
  bonusExpiresAfterDays: number | null;
  active: boolean;
};

export type PackBonus = { promotionId: string; coins: number; expiresAt: Date | null } | null;

export function bestPackBonus(input: {
  promotions: readonly PromotionRow[];
  packId: string;
  packCoins: number;
  inCohort: boolean;
  now: Date;
}): PackBonus {
  const t = input.now.getTime();
  let best: PackBonus = null;
  for (const p of input.promotions) {
    if (!p.active || p.kind !== "percent_on_pack") continue;
    if (t < p.startsAt.getTime() || t >= p.endsAt.getTime()) continue;
    if (p.packId && p.packId !== input.packId) continue;
    if (p.audience === "cohort" && !input.inCohort) continue;
    const coins = Math.floor((input.packCoins * p.value) / 100);
    if (coins <= 0) continue;
    if (!best || coins > best.coins) {
      best = {
        promotionId: p.id,
        coins,
        expiresAt: p.bonusExpiresAfterDays ? new Date(t + p.bonusExpiresAfterDays * 24 * 60 * 60_000) : null,
      };
    }
  }
  return best;
}
