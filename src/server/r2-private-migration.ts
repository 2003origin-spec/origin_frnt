/**
 * One-off move of private files out of the public R2 bucket (plan:
 * V1/PRIVATE_R2_BUCKET_PLAN.md). Before R2_PRIVATE_BUCKET existed, import
 * sources, contest proctor frames and Origin NOW files were written to the
 * public image bucket, where anyone holding a key can read them. Driven by
 * scripts/move-private-r2-objects.ts:
 *
 *   dry-run        list what would move; changes nothing
 *   copy           server-side copy into R2_PRIVATE_BUCKET; safe to re-run
 *   delete-public  for each object whose private copy matches (size + ETag):
 *                  point import-job rows at the private bucket, then delete
 *                  the public copy
 *
 * Nothing is ever deleted without a verified private copy.
 */

import type { Pool } from "pg";

import {
  copyR2Object,
  deleteR2Object,
  headR2Object,
  listR2Objects,
  privateR2BucketName,
  publicR2BucketName,
  type R2ObjectInfo,
} from "@/server/media-storage";
import { getUserPostgresPool } from "@/server/user-postgres";

/** Top-level folders of the public bucket that hold private files. */
export const PRIVATE_KEY_PREFIXES = ["imports/", "contest-proctor/", "origin-now/"] as const;

/**
 * Pure: does this public-bucket key belong in the private bucket? Everything
 * under PRIVATE_KEY_PREFIXES does, except the import worker's question
 * diagrams (imports/<job>/diagrams/…), which students load by public URL.
 */
export function isPrivateObjectKey(key: string): boolean {
  if (!PRIVATE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) return false;
  return !/^imports\/[^/]+\/diagrams\//u.test(key);
}

/** Pure: is `copy` a faithful copy of `source`? Multipart ETags ("…-N") can't be compared. */
export function copyMatches(source: R2ObjectInfo, copy: { sizeBytes: number; etag: string }): boolean {
  if (copy.sizeBytes !== source.sizeBytes) return false;
  return source.etag.includes("-") || copy.etag === source.etag;
}

export type MoveMode = "dry-run" | "copy" | "delete-public";

export type MoveReport = {
  mode: MoveMode;
  publicBucket: string;
  privateBucket: string;
  byPrefix: Record<string, { objects: number; bytes: number; examples: string[] }>;
  keptPublicDiagrams: number;
  copied: number;
  alreadyCopied: number;
  importJobRowsUpdated: number;
  deleted: number;
  notCopiedYet: number;
  failures: { key: string; error: string }[];
};

export async function runPrivateObjectMove(
  mode: MoveMode,
  /** Tests pass a stub; the script uses USER_DATABASE_URL. Only delete-public touches the DB. */
  options: { db?: Pick<Pool, "query"> } = {},
): Promise<MoveReport> {
  const publicBucket = publicR2BucketName();
  const privateBucket = privateR2BucketName();
  const pool = mode === "delete-public" ? (options.db ?? getUserPostgresPool()) : null;
  if (mode === "delete-public" && !pool) {
    throw new Error("USER_DATABASE_URL is required for --delete-public (import jobs must be pointed at the private bucket).");
  }

  const report: MoveReport = {
    mode,
    publicBucket,
    privateBucket,
    byPrefix: {},
    keptPublicDiagrams: 0,
    copied: 0,
    alreadyCopied: 0,
    importJobRowsUpdated: 0,
    deleted: 0,
    notCopiedYet: 0,
    failures: [],
  };

  const toMove: R2ObjectInfo[] = [];
  for (const prefix of PRIVATE_KEY_PREFIXES) {
    const listed = await listR2Objects({ bucket: publicBucket, prefix });
    const privateOnes = listed.filter((object) => isPrivateObjectKey(object.key));
    report.keptPublicDiagrams += listed.length - privateOnes.length;
    report.byPrefix[prefix] = {
      objects: privateOnes.length,
      bytes: privateOnes.reduce((sum, object) => sum + object.sizeBytes, 0),
      examples: privateOnes.slice(0, 3).map((object) => object.key),
    };
    toMove.push(...privateOnes);
  }
  if (mode === "dry-run") return report;

  // Only import jobs record a bucket; every other flow stores just the key.
  const hasImportJobs = pool
    ? (await pool.query<{ t: string | null }>(`SELECT to_regclass('import.document_import_jobs')::text AS t`)).rows[0]?.t != null
    : false;

  for (const object of toMove) {
    try {
      const existing = await headR2Object({ bucket: privateBucket, objectKey: object.key });
      const verified = existing !== null && copyMatches(object, existing);

      if (mode === "copy") {
        if (verified) {
          report.alreadyCopied += 1;
          continue;
        }
        await copyR2Object({ fromBucket: publicBucket, toBucket: privateBucket, objectKey: object.key });
        const check = await headR2Object({ bucket: privateBucket, objectKey: object.key });
        if (!check || !copyMatches(object, check)) throw new Error("copy did not verify (size or ETag differs)");
        report.copied += 1;
        continue;
      }

      // delete-public
      if (!verified) {
        report.notCopiedYet += 1;
        continue;
      }
      if (hasImportJobs && pool && object.key.startsWith("imports/")) {
        const updated = await pool.query(
          `UPDATE import.document_import_jobs SET source_r2_bucket = $1
            WHERE source_r2_bucket = $2 AND source_r2_object_key = $3`,
          [privateBucket, publicBucket, object.key],
        );
        report.importJobRowsUpdated += updated.rowCount ?? 0;
      }
      await deleteR2Object({ bucket: publicBucket, objectKey: object.key });
      report.deleted += 1;
    } catch (error) {
      report.failures.push({ key: object.key, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return report;
}
