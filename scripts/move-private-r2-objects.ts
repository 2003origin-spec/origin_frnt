/**
 * Move private files out of the public R2 bucket into R2_PRIVATE_BUCKET.
 * One-off, run around the deploy of the private-bucket fix. Plan and deploy
 * order: V1/PRIVATE_R2_BUCKET_PLAN.md (Phase 2).
 *
 * Moves imports/ (except imports/<job>/diagrams/, which are public question
 * images), contest-proctor/ and origin-now/.
 *
 * Usage (secrets only at run time, never committed):
 *   cd new-frontend
 *   npx tsx --env-file=<prod env file> scripts/move-private-r2-objects.ts                  # dry run
 *   npx tsx --env-file=<prod env file> scripts/move-private-r2-objects.ts --copy           # copy, safe to re-run
 *   npx tsx --env-file=<prod env file> scripts/move-private-r2-objects.ts --delete-public  # after the deploy
 *
 * Dry run is the default and changes nothing. --delete-public deletes a public
 * copy only when the private copy has the same size and ETag, and first points
 * matching import.document_import_jobs rows at the private bucket.
 *
 * Needs R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT (or R2_ENDPOINT_URL /
 * R2_ACCOUNT_ID), R2_BUCKET_NAME and R2_PRIVATE_BUCKET; --delete-public also
 * needs USER_DATABASE_URL.
 */

import { runPrivateObjectMove, type MoveMode } from "@/server/r2-private-migration";

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

function modeFromArgs(args: string[]): MoveMode {
  const unknown = args.filter((arg) => arg !== "--copy" && arg !== "--delete-public");
  if (unknown.length > 0) fail(`Unknown option(s): ${unknown.join(" ")}. Use --copy or --delete-public (or nothing for a dry run).`);
  if (args.includes("--copy") && args.includes("--delete-public")) fail("Use --copy or --delete-public, not both.");
  if (args.includes("--copy")) return "copy";
  if (args.includes("--delete-public")) return "delete-public";
  return "dry-run";
}

function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function main() {
  const mode = modeFromArgs(process.argv.slice(2));
  const report = await runPrivateObjectMove(mode);

  console.log(`\n[r2 move] mode: ${report.mode}`);
  console.log(`[r2 move] from public bucket "${report.publicBucket}" to private bucket "${report.privateBucket}"\n`);
  for (const [prefix, stats] of Object.entries(report.byPrefix)) {
    console.log(`  ${prefix.padEnd(18)} ${String(stats.objects).padStart(6)} file(s)  ${megabytes(stats.bytes)}`);
    for (const key of stats.examples) console.log(`      e.g. ${key}`);
  }
  console.log(`  (left in place: ${report.keptPublicDiagrams} public question diagram(s) under imports/*/diagrams/)\n`);

  if (mode === "copy") {
    console.log(`[r2 move] copied ${report.copied}, already copied ${report.alreadyCopied}.`);
  } else if (mode === "delete-public") {
    console.log(
      `[r2 move] deleted ${report.deleted} public copy(ies); ${report.notCopiedYet} not copied yet (run --copy first); ` +
        `${report.importJobRowsUpdated} import job row(s) now point at the private bucket.`,
    );
  } else {
    console.log("[r2 move] dry run: nothing was changed. Next: --copy.");
  }

  if (report.failures.length > 0) {
    console.error(`\n[r2 move] ${report.failures.length} failure(s):`);
    for (const failure of report.failures.slice(0, 20)) console.error(`  ${failure.key}: ${failure.error}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error("[r2 move] failed", error instanceof Error ? error.message : error);
  process.exit(1);
});
