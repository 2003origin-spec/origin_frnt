/**
 * Per-cell closing-rank trend hint for the counselling tool (plan §4.7, §11.3).
 * Text only: it never changes a Safe / Likely / Reach band. Pure.
 */

export type ClosingPoint = { year: number; closing: number };

/** "closing rank rose 2 years in a row" (higher rank number = easier to get), or null. */
export function closingTrendHint(points: readonly ClosingPoint[]): string | null {
  const sorted = [...points].filter((p) => Number.isFinite(p.closing)).sort((a, b) => a.year - b.year);
  if (sorted.length < 3) return null;
  let rises = 0;
  let falls = 0;
  for (let i = sorted.length - 1; i > 0; i -= 1) {
    const diff = sorted[i].closing - sorted[i - 1].closing;
    if (diff > 0 && falls === 0) rises += 1;
    else if (diff < 0 && rises === 0) falls += 1;
    else break;
  }
  if (rises >= 2) return `closing rank rose ${rises} years in a row`;
  if (falls >= 2) return `closing rank fell ${falls} years in a row`;
  return null;
}
