/**
 * One-time backfill — publish stranded OG-Code contributions and sync them into
 * the student OG-Code catalog (`ogcode_questions`) with institute attribution.
 *
 * Why this exists: contributions approved under the pre-#207 flow are stuck at
 * `status='approved'` (never `published`), so the publish-time catalog sync
 * never ran and they never reached the student pool (prod: `is_contributed=0`).
 * This publishes each stranded `approved` row and upserts it into the catalog,
 * with loud per-row success/failure (the runtime sync is best-effort/silent).
 *
 * Usage (secrets only at migration time, never committed):
 *   cd new-frontend
 *   npx tsx --env-file=/Users/xyx/Projects/Origin/.env \
 *     scripts/backfill-ogcode-publish-stranded.ts
 *
 * Idempotent: re-publishing a published row is a no-op; the catalog write is an
 * ON CONFLICT (id) upsert. Exit code 2 if any row failed to sync.
 */

import { upsertContributedCatalogQuestion } from "@/server/ogcode-catalog";
import { isOgcodePostgresConfigured } from "@/server/postgres";
import {
  listSubmittedPublications,
  publishPublication,
} from "@/server/workspaces/ogcode-publishing-store";
import { getVersionById } from "@/server/workspaces/questions";

/** Mirrors the private mapping in ogcode-publishing-service. */
function toCatalogQuestionType(t: string): string {
  if (t === "mcq" || t === "msq" || t === "matrix_match" || t === "subjective") return t;
  if (t === "numerical" || t === "numerical_with_units") return "numerical";
  return "subjective";
}

async function main() {
  if (!process.env.USER_DATABASE_URL) {
    console.error("USER_DATABASE_URL is not set — load the prod env file before running.");
    process.exit(1);
  }
  if (!isOgcodePostgresConfigured()) {
    console.error("OGCODE database is not configured — the catalog sync would silently no-op. Aborting.");
    process.exit(1);
  }

  // listSubmittedPublications returns status IN ('submitted','approved'); only
  // the 'approved' rows are stranded (submitted ones still need admin review).
  const queue = await listSubmittedPublications(1000);
  const approved = queue.filter((p) => p.status === "approved");
  console.log(`[backfill] ${approved.length} stranded 'approved' publication(s) to publish + sync.`);

  let published = 0;
  let synced = 0;
  let failed = 0;

  for (const pub of approved) {
    try {
      const pubRow = await publishPublication({
        publicationId: pub.id,
        reviewerUserId: pub.reviewedBy ?? "system-backfill",
      });
      if (!pubRow) {
        console.warn(`  - ${pub.id}: publish no-op (not in approved/submitted state), skipping`);
        continue;
      }
      published += 1;

      const version = await getVersionById(pubRow.questionVersionId);
      if (!version) {
        console.error(`  ✗ ${pub.id}: question version ${pubRow.questionVersionId} missing — cannot sync`);
        failed += 1;
        continue;
      }

      await upsertContributedCatalogQuestion({
        id: pubRow.questionId,
        text: version.stem,
        options: version.options ? version.options.map((o) => o.text) : null,
        correctOption: version.correctOption,
        correctOptions: version.correctOptions,
        answerText: version.answerText,
        answerSpec: version.answerSpec,
        tolerance: null,
        matrixData: version.matrixData,
        explanation: version.fullSolution ?? version.explanation ?? "",
        hint: version.hint,
        subject: version.subject,
        chapter: version.chapter,
        concept: version.concept,
        difficulty: version.difficulty,
        questionType: toCatalogQuestionType(version.questionType),
        tags: version.tags,
        contributorWorkspaceId: pubRow.contributorWorkspaceId,
        attributionName: pubRow.attributionName,
        attributionLogoUrl: null,
      });
      synced += 1;
      console.log(
        `  ✓ ${pub.id}: published + synced (${version.subject}/${version.chapter}, "${pubRow.attributionName}")`,
      );
    } catch (error) {
      failed += 1;
      console.error(`  ✗ ${pub.id}: FAILED —`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`[backfill] done. published=${published} synced=${synced} failed=${failed}`);
  process.exit(failed > 0 ? 2 : 0);
}

main().catch((error) => {
  console.error("[backfill] fatal", error);
  process.exit(1);
});
