/**
 * Where Origin NOW keeps files only their owner and admins may read
 * (decision B96): solver KYC documents, paid PDF papers, and ask-later
 * photos. They go to the private bucket `R2_PRIVATE_BUCKET` and are only
 * ever read through short signed links.
 *
 * Never the default bucket (`R2_BUCKET_NAME`, "origin" when unset): that is
 * the public image bucket, whose r2.dev address serves any object to whoever
 * has its key. Naming it counts as not set, like the recording bucket (B87).
 * Without a private bucket these uploads are refused with a clear message
 * and the launch check is red. The app's own R2 key must be allowed on the
 * private bucket.
 */

import { deleteR2Object } from "@/server/media-storage";

import { NowError } from "./now-http";

export type PrivateFilesBucket = { name: string; problem: null } | { name: null; problem: "not_set" | "public" };

const env = (key: string) => process.env[key]?.trim() || null;

export function getPrivateFilesBucket(): PrivateFilesBucket {
  const name = env("R2_PRIVATE_BUCKET");
  if (!name) return { name: null, problem: "not_set" };
  const publicBucket = env("R2_BUCKET_NAME") ?? "origin";
  if (name.toLowerCase() === publicBucket.toLowerCase()) return { name: null, problem: "public" };
  return { name, problem: null };
}

/** The private bucket's name, or a 503 the screens show as "uploads are not available". */
export function requirePrivateFilesBucket(): string {
  const bucket = getPrivateFilesBucket();
  if (!bucket.name) {
    console.error(`[origin-now] private files refused: R2_PRIVATE_BUCKET ${bucket.problem === "public" ? "names the public bucket" : "is not set"}`);
    throw new NowError(503, "storage_unavailable", "Uploads are not available right now. Please try later.");
  }
  return bucket.name;
}

/** Best-effort delete from the private bucket (nothing to do without one). */
export async function deletePrivateFile(objectKey: string): Promise<void> {
  const bucket = getPrivateFilesBucket().name;
  if (!bucket) return;
  await deleteR2Object({ bucket, objectKey }).catch(() => undefined);
}
