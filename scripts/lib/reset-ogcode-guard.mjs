/**
 * Pure guard logic for scripts/reset-ogcode-scores.ts (the one-time OGCode
 * Scoring V2 cutover). Kept free of database access so it can be unit tested.
 *
 * The script wipes every OGCode point, rank and per-question progress row. It
 * was meant to run exactly once (2026-07-12). Since V2 shipped, the live solve
 * path writes point logs that match the same filter, so a second run deletes
 * real, post-cutover points. These helpers make a second run opt-in only.
 */

/** Ledger id written to app.migrations by a real (--apply) run. */
export const RESET_MARKER_ID = "ogcode_scoring_v2_reset";
export const RESET_MARKER_NAME = "OGCode Scoring V2 one-time score reset";

const KNOWN_FLAGS = new Set(["--apply", "--dry-run", "--force-rerun"]);

/**
 * Dry run is the default. Writing needs `--apply`; `--dry-run` is still
 * accepted (it is what old runbook lines say) but conflicts with `--apply`.
 * Unknown flags are an error so a typo such as `--aply` cannot fall through
 * to some other behaviour.
 *
 * @param {readonly string[]} argv  process.argv.slice(2)
 * @returns {{ apply: boolean, forceRerun: boolean, error: string | null }}
 */
export function parseResetArgs(argv) {
  const unknown = argv.filter((arg) => !KNOWN_FLAGS.has(arg));
  const apply = argv.includes("--apply");
  const forceRerun = argv.includes("--force-rerun");
  if (unknown.length) {
    return { apply: false, forceRerun, error: `Unknown argument(s): ${unknown.join(" ")}` };
  }
  if (apply && argv.includes("--dry-run")) {
    return { apply: false, forceRerun, error: "--apply and --dry-run are mutually exclusive." };
  }
  return { apply, forceRerun, error: null };
}

/**
 * Decides whether the reset may proceed.
 *
 * "Already applied" is either of:
 *  - `markerPresent`: the app.migrations ledger row a real run writes;
 *  - `staleProgressPresent`: ogcode_question_progress holds a row last touched
 *    more than 24 h ago. At a genuine cutover that table had only just been
 *    created by the V2 migration, so old rows mean V2 has been live for a while
 *    and a reset would wipe points earned under it. This also covers prod, where
 *    the 2026-07-12 run predates the marker.
 *
 * Both dry run and apply are refused in that state (a dry run on prod still
 * takes row locks on app.point_logs), unless `--force-rerun` is given.
 *
 * `hint` is the operator-facing next step for a refusal, worded for what was
 * actually asked (a dry run is told why a preview is refused, not that it
 * would wipe points).
 *
 * @param {{ apply: boolean, forceRerun: boolean, markerPresent: boolean, staleProgressPresent: boolean }} input
 * @returns {{ proceed: boolean, exitCode: 0 | 1, reasons: string[], hint: string | null }}
 */
export function decideResetRun({ apply, forceRerun, markerPresent, staleProgressPresent }) {
  const reasons = [];
  if (markerPresent) {
    reasons.push(`app.migrations already has '${RESET_MARKER_ID}' (a previous --apply run completed).`);
  }
  if (staleProgressPresent) {
    reasons.push(
      "ogcode_question_progress has rows older than 24 hours, so Scoring V2 has been live and a reset " +
        "would delete points students earned after the cutover.",
    );
  }
  if (reasons.length && !forceRerun) {
    const hint = apply
      ? "Re-running wipes every OGCode point and progress row earned since. " +
        "Pass --force-rerun as well only if that is truly intended."
      : "This was a dry run: nothing was changed. The preview is refused too because it still " +
        "takes row locks on app.point_logs. Pass --force-rerun (without --apply) to preview anyway.";
    return { proceed: false, exitCode: 1, reasons, hint };
  }
  return { proceed: true, exitCode: 0, reasons, hint: null };
}
