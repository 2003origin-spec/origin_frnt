/**
 * Canonical points formatter.
 *
 * Points are FRACTIONAL: the OGCode base score is scaled by speed and divided
 * by attempt count, so a real total is routinely `31.666666666666664`. Rendered
 * raw that reads as noise and overflows its container — a phone showed the full
 * float running off the OGCode header (reported 2026-09-21).
 *
 * Two decimals at most, trailing zeros dropped (`30` stays `30`, not `30.00`),
 * Indian digit grouping to match the rest of the money/number formatting.
 *
 * `toLocaleString()` with no options is NOT a substitute: it caps at three
 * fraction digits, so it turns that total into `31.667`.
 */
export function formatPoints(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

/** Same rounding, signed — for per-event deltas in the points log. */
export function formatPointsDelta(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0';
  return `${n >= 0 ? '+' : ''}${formatPoints(n)}`;
}
