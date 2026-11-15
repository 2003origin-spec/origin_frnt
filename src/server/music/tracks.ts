/**
 * Study Music — track rows: the column list, the row → API mapping and the
 * reads both doors share (V1/STUDY_MUSIC_PLAN.md §4.4, §4.6).
 */

import type { MusicMood, MusicTrackStatus } from "@/lib/study-music";
import { privateR2BucketName } from "@/server/media-storage";
import { getUserPostgresPool } from "@/server/user-postgres";

import { MusicError } from "./rules";
import { ensureMusicSchema } from "./schema";

export type MusicTrackRow = {
  id: string;
  title: string;
  artist: string;
  mood: MusicMood;
  duration_seconds: number;
  loopable: boolean;
  allow_offline: boolean;
  object_key: string;
  mime_type: string;
  size_bytes: string | number;
  sha256: string;
  source_url: string;
  licence_name: string;
  licence_url: string;
  attribution_required: boolean;
  attribution_text: string;
  licence_proof_key: string | null;
  status: MusicTrackStatus;
  sort_order: number;
  created_by: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  published_at: Date | string | null;
};

export const TRACK_COLUMNS = `id, title, artist, mood, duration_seconds, loopable, allow_offline, object_key, mime_type,
  size_bytes, sha256, source_url, licence_name, licence_url, attribution_required, attribution_text,
  licence_proof_key, status, sort_order, created_by, created_at, updated_at, published_at`;

export function musicPool() {
  const p = getUserPostgresPool();
  if (!p) throw new MusicError(503, "db_unavailable", "BoomBoom needs the database. Try again later.");
  return p;
}

/** The private R2 bucket, or a 503 the admin can read when storage isn't set up. */
export function musicBucket(): string {
  try {
    return privateR2BucketName();
  } catch (error) {
    console.error("[music] private bucket unavailable:", error instanceof Error ? error.message : error);
    throw new MusicError(503, "storage_unavailable", "Music storage is not set up (R2_PRIVATE_BUCKET). Ask a developer.");
  }
}

/** Ensure the schema, then the pool. Every music query goes through this. */
export async function musicDb() {
  const p = musicPool();
  await ensureMusicSchema();
  return p;
}

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/**
 * A version the app compares with its downloaded copy. The file behind a track
 * never changes (a new file is a new track), so the content hash is the version:
 * edits to the title or credit don't force a re-download.
 */
export function trackVersion(row: Pick<MusicTrackRow, "sha256">): string {
  return row.sha256.slice(0, 16);
}

/** What a student sees: published tracks only, no object key, no proof. */
export function studentTrack(row: MusicTrackRow) {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    mood: row.mood,
    durationSeconds: row.duration_seconds,
    sizeBytes: Number(row.size_bytes),
    sha256: row.sha256,
    mimeType: row.mime_type,
    loopable: row.loopable,
    allowOffline: row.allow_offline,
    version: trackVersion(row),
    credit: {
      required: row.attribution_required,
      text: row.attribution_text,
      licenceName: row.licence_name,
      licenceUrl: row.licence_url,
      sourceUrl: row.source_url,
    },
  };
}
export type StudentMusicTrack = ReturnType<typeof studentTrack>;

/** What an admin sees: every field (the object keys are server-made, nothing secret). */
export function adminTrack(row: MusicTrackRow) {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    mood: row.mood,
    durationSeconds: row.duration_seconds,
    loopable: row.loopable,
    allowOffline: row.allow_offline,
    objectKey: row.object_key,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    sha256: row.sha256,
    sourceUrl: row.source_url,
    licenceName: row.licence_name,
    licenceUrl: row.licence_url,
    attributionRequired: row.attribution_required,
    attributionText: row.attribution_text,
    hasProof: Boolean(row.licence_proof_key),
    status: row.status,
    sortOrder: row.sort_order,
    createdBy: row.created_by,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    publishedAt: iso(row.published_at),
  };
}
export type AdminMusicTrack = ReturnType<typeof adminTrack>;

export async function listPublishedTracks(): Promise<MusicTrackRow[]> {
  const p = await musicDb();
  const { rows } = await p.query<MusicTrackRow>(
    `SELECT ${TRACK_COLUMNS} FROM music.tracks WHERE status = 'published'
      ORDER BY mood, sort_order, created_at, id`,
  );
  return rows;
}

export async function findTrack(id: string): Promise<MusicTrackRow | null> {
  const p = await musicDb();
  const { rows } = await p.query<MusicTrackRow>(`SELECT ${TRACK_COLUMNS} FROM music.tracks WHERE id = $1`, [id]);
  return rows[0] ?? null;
}
