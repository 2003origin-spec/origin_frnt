/**
 * Study Music — admin operations behind /api/admin/music (V1/STUDY_MUSIC_PLAN.md §4.7).
 *
 * Uploads go straight from the browser to the PRIVATE R2 bucket with a
 * presigned PUT signed for one type and one exact size. Creating the track
 * then proves the upload: the HMAC token must be the one issued to this admin
 * for this key and size, the object must exist at exactly that size, its first
 * bytes must be audio of the declared type, and its SHA-256 must equal the one
 * the browser computed (the app checks downloads against it). Every write is
 * audited (`music.track.*`). The audio file of a track never changes: a new
 * file is a new track.
 */

import { createHash, randomUUID } from "node:crypto";

import {
  MUSIC_LICENCE_FIELD_LABELS,
  MUSIC_PREVIEW_LINK_SECONDS,
  MUSIC_UPLOAD_LINK_SECONDS,
  MUSIC_AUDIO_MAX_BYTES,
  MUSIC_PROOF_MAX_BYTES,
  audioMimeForKey,
  isMusicProofKey,
  isMusicTrackKey,
  isSha256Hex,
  isUuid,
  looksLikeAudio,
  looksLikeProof,
  missingLicenceFields,
  musicObjectKey,
  parsePresignInput,
  parseTrackFields,
  parseTrackPatch,
  proofMimeForKey,
  type MusicTrackFields,
} from "@/lib/study-music";
import { isFeatureEnabledRuntime } from "@/server/feature-flags-runtime";
import { createPresignedR2PutUrl, deleteR2Object, headR2Object, readR2ObjectStart } from "@/server/media-storage";
import { recordAuditEvent } from "@/server/workspaces/audit";

import { MusicError, createMusicUploadToken, verifyMusicUploadToken } from "./rules";
import { TRACK_COLUMNS, adminTrack, findTrack, musicBucket, musicDb, type AdminMusicTrack, type MusicTrackRow } from "./tracks";

async function audit(adminId: string, action: string, trackId: string, before?: unknown, after?: unknown): Promise<void> {
  try {
    await recordAuditEvent({
      actorUserId: adminId,
      workspaceId: null,
      entityType: "music_track",
      entityId: trackId,
      action,
      before,
      after,
    });
  } catch (error) {
    // The write already happened; a lost audit row is logged, not a failed request.
    console.error("[admin music] audit failed:", error instanceof Error ? error.message : error);
  }
}

function auditView(row: MusicTrackRow) {
  return {
    title: row.title,
    artist: row.artist,
    mood: row.mood,
    status: row.status,
    licenceName: row.licence_name,
    licenceUrl: row.licence_url,
    sourceUrl: row.source_url,
    attributionRequired: row.attribution_required,
    sortOrder: row.sort_order,
    objectKey: row.object_key,
    sha256: row.sha256,
  };
}

async function requireTrack(id: string): Promise<MusicTrackRow> {
  if (!isUuid(id)) throw new MusicError(404, "not_found", "Track not found.");
  const row = await findTrack(id);
  if (!row) throw new MusicError(404, "not_found", "Track not found.");
  return row;
}

// ── List ─────────────────────────────────────────────────────────────────────

export async function listAdminTracks(): Promise<{
  tracks: AdminMusicTrack[];
  storageBytes: number;
  studentsCanSee: boolean;
}> {
  const p = await musicDb();
  const { rows } = await p.query<MusicTrackRow>(
    `SELECT ${TRACK_COLUMNS} FROM music.tracks
      ORDER BY CASE status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, mood, sort_order, created_at, id`,
  );
  const storageBytes = rows.reduce((sum, row) => sum + Number(row.size_bytes), 0);
  return { tracks: rows.map(adminTrack), storageBytes, studentsCanSee: await isFeatureEnabledRuntime("studyMusic") };
}

// ── Presign ──────────────────────────────────────────────────────────────────

export function presignMusicUpload(adminId: string, body: Record<string, unknown>) {
  const parsed = parsePresignInput(body);
  if (!parsed.ok) throw new MusicError(400, "invalid_upload", parsed.error);
  const { kind, contentType, size } = parsed.value;
  const objectKey = musicObjectKey(kind, randomUUID(), contentType);
  const signed = createPresignedR2PutUrl({
    method: "PUT",
    bucket: musicBucket(),
    objectKey,
    contentType,
    contentLength: size,
    expiresSeconds: MUSIC_UPLOAD_LINK_SECONDS,
  });
  return {
    uploadUrl: signed.url,
    uploadHeaders: signed.headers,
    objectKey,
    uploadToken: createMusicUploadToken(adminId, objectKey, size),
  };
}

// ── Upload checks ────────────────────────────────────────────────────────────

/** The object exists at exactly the size the token was issued for. */
async function requireUploadedSize(bucket: string, objectKey: string, size: number, what: string): Promise<void> {
  const head = await headR2Object({ bucket, objectKey });
  if (!head) throw new MusicError(409, "upload_missing", `The ${what} upload was not found. Upload it again.`);
  if (head.sizeBytes !== size) throw new MusicError(409, "upload_size", `The ${what} upload is not the size that was signed. Upload it again.`);
}

async function checkAudioUpload(adminId: string, objectKey: unknown, token: unknown, sha256: unknown) {
  if (!isMusicTrackKey(objectKey)) throw new MusicError(400, "invalid_key", "That is not a music upload.");
  const size = verifyMusicUploadToken(token, adminId, objectKey);
  if (size === null || size > MUSIC_AUDIO_MAX_BYTES) {
    throw new MusicError(403, "invalid_token", "This upload was not issued to you, or it is older than 10 minutes. Upload the file again.");
  }
  if (!isSha256Hex(sha256)) throw new MusicError(400, "invalid_sha256", "The file's SHA-256 is missing. Reload the page and upload again.");
  const mime = audioMimeForKey(objectKey)!;
  const bucket = musicBucket();
  await requireUploadedSize(bucket, objectKey, size, "audio");
  // At most 15 MB: read it all once for the type check and the hash.
  const bytes = await readR2ObjectStart({ bucket, objectKey, bytes: size });
  if (!bytes || bytes.length !== size) throw new MusicError(409, "upload_size", "The audio upload could not be read back. Upload it again.");
  if (!looksLikeAudio(bytes, mime)) {
    throw new MusicError(400, "not_audio", mime === "audio/mp4" ? "That file is not an .m4a (MP4 audio) file." : "That file is not an .mp3 file.");
  }
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== sha256) throw new MusicError(400, "sha256_mismatch", "The uploaded file does not match the file you picked. Upload it again.");
  return { objectKey, size, mime, sha256: actual };
}

async function checkProofUpload(adminId: string, proofKey: unknown, proofToken: unknown): Promise<string> {
  if (!isMusicProofKey(proofKey)) throw new MusicError(400, "invalid_key", "That is not a licence-proof upload.");
  const size = verifyMusicUploadToken(proofToken, adminId, proofKey);
  if (size === null || size > MUSIC_PROOF_MAX_BYTES) {
    throw new MusicError(403, "invalid_token", "This proof upload was not issued to you, or it is older than 10 minutes. Upload it again.");
  }
  const bucket = musicBucket();
  await requireUploadedSize(bucket, proofKey, size, "proof");
  const start = await readR2ObjectStart({ bucket, objectKey: proofKey, bytes: 16 });
  if (!start || !looksLikeProof(start, proofMimeForKey(proofKey)!)) {
    throw new MusicError(400, "not_proof", "The licence proof must be a real PDF, PNG or JPEG.");
  }
  return proofKey;
}

async function removeObjects(keys: (string | null)[]): Promise<void> {
  for (const key of keys) {
    if (!key) continue;
    try {
      await deleteR2Object({ bucket: musicBucket(), objectKey: key });
    } catch (error) {
      // The row is the source of truth; an orphaned file only costs storage.
      console.error("[admin music] object delete failed:", error instanceof Error ? error.message : error);
    }
  }
}

// ── Create / edit ────────────────────────────────────────────────────────────

export async function createTrack(adminId: string, body: Record<string, unknown>): Promise<AdminMusicTrack> {
  const fields = parseTrackFields(body);
  if (!fields.ok) throw new MusicError(400, "invalid_track", fields.error);
  const audio = await checkAudioUpload(adminId, body.objectKey, body.uploadToken, body.sha256);
  const proofKey = body.proofKey === undefined || body.proofKey === null ? null : await checkProofUpload(adminId, body.proofKey, body.proofToken);
  const f: MusicTrackFields = fields.value;
  const p = await musicDb();
  const id = randomUUID();
  let row: MusicTrackRow;
  try {
    const { rows } = await p.query<MusicTrackRow>(
      `INSERT INTO music.tracks (id, title, artist, mood, duration_seconds, loopable, allow_offline, object_key, mime_type,
         size_bytes, sha256, source_url, licence_name, licence_url, attribution_required, attribution_text,
         licence_proof_key, status, sort_order, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'draft',$18,$19)
       RETURNING ${TRACK_COLUMNS}`,
      [
        id, f.title, f.artist, f.mood, f.durationSeconds, f.loopable, f.allowOffline, audio.objectKey, audio.mime,
        audio.size, audio.sha256, f.sourceUrl, f.licenceName, f.licenceUrl, f.attributionRequired, f.attributionText,
        proofKey, f.sortOrder, adminId,
      ],
    );
    row = rows[0];
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new MusicError(409, "duplicate_upload", "A track already uses this upload.");
    }
    throw error;
  }
  await audit(adminId, "music.track.created", id, undefined, auditView(row));
  return adminTrack(row);
}

const PATCH_COLUMNS: Record<keyof MusicTrackFields, string> = {
  title: "title",
  artist: "artist",
  mood: "mood",
  durationSeconds: "duration_seconds",
  loopable: "loopable",
  allowOffline: "allow_offline",
  sortOrder: "sort_order",
  sourceUrl: "source_url",
  licenceName: "licence_name",
  licenceUrl: "licence_url",
  attributionRequired: "attribution_required",
  attributionText: "attribution_text",
};

/** Edits text fields, mood, order and flags, and may attach licence proof. Not the audio file. */
export async function updateTrack(adminId: string, id: string, body: Record<string, unknown>): Promise<AdminMusicTrack> {
  const before = await requireTrack(id);
  const hasProof = body.proofKey !== undefined && body.proofKey !== null;
  const rest = { ...body };
  delete rest.proofKey;
  delete rest.proofToken;
  const sets: string[] = [];
  const values: unknown[] = [id];
  if (Object.keys(rest).length || !hasProof) {
    const patch = parseTrackPatch(rest);
    if (!patch.ok) throw new MusicError(400, "invalid_track", patch.error);
    for (const [key, value] of Object.entries(patch.value) as [keyof MusicTrackFields, unknown][]) {
      values.push(value);
      sets.push(`${PATCH_COLUMNS[key]} = $${values.length}`);
    }
  }
  let oldProof: string | null = null;
  if (hasProof) {
    values.push(await checkProofUpload(adminId, body.proofKey, body.proofToken));
    sets.push(`licence_proof_key = $${values.length}`);
    oldProof = before.licence_proof_key;
  }
  const p = await musicDb();
  const { rows } = await p.query<MusicTrackRow>(
    `UPDATE music.tracks SET ${sets.join(", ")}, updated_at = now() WHERE id = $1 RETURNING ${TRACK_COLUMNS}`,
    values,
  );
  if (!rows[0]) throw new MusicError(404, "not_found", "Track not found.");
  if (oldProof && oldProof !== rows[0].licence_proof_key) await removeObjects([oldProof]);
  await audit(adminId, "music.track.updated", id, auditView(before), auditView(rows[0]));
  return adminTrack(rows[0]);
}

// ── Status changes ───────────────────────────────────────────────────────────

/** Draft → published. Refused unless every licence field is filled and the file is still there. */
export async function publishTrack(adminId: string, id: string): Promise<AdminMusicTrack> {
  const row = await requireTrack(id);
  if (row.status !== "draft") throw new MusicError(409, "not_draft", "Only a draft can be published. Upload a new track to bring a retired one back.");
  const missing = missingLicenceFields({
    sourceUrl: row.source_url,
    licenceName: row.licence_name,
    licenceUrl: row.licence_url,
    attributionRequired: row.attribution_required,
    attributionText: row.attribution_text,
  });
  if (missing.length) {
    throw new MusicError(400, "licence_incomplete", `Fill in the ${missing.map((m) => MUSIC_LICENCE_FIELD_LABELS[m]).join(", ")} before publishing.`);
  }
  const head = await headR2Object({ bucket: musicBucket(), objectKey: row.object_key });
  if (!head || head.sizeBytes !== Number(row.size_bytes)) {
    throw new MusicError(409, "file_missing", "The audio file for this track is missing. Delete the track and upload it again.");
  }
  const p = await musicDb();
  const { rows } = await p.query<MusicTrackRow>(
    `UPDATE music.tracks SET status = 'published', published_at = now(), updated_at = now()
      WHERE id = $1 AND status = 'draft' RETURNING ${TRACK_COLUMNS}`,
    [id],
  );
  if (!rows[0]) throw new MusicError(409, "not_draft", "This track changed while you were looking. Reload.");
  await audit(adminId, "music.track.published", id, { status: row.status }, auditView(rows[0]));
  return adminTrack(rows[0]);
}

/** Published → retired: gone from every list, no new links, apps delete their copy at the next sync. */
export async function retireTrack(adminId: string, id: string): Promise<AdminMusicTrack> {
  const row = await requireTrack(id);
  const p = await musicDb();
  const { rows } = await p.query<MusicTrackRow>(
    `UPDATE music.tracks SET status = 'retired', updated_at = now()
      WHERE id = $1 AND status = 'published' RETURNING ${TRACK_COLUMNS}`,
    [id],
  );
  if (!rows[0]) throw new MusicError(409, "not_published", "Only a published track can be retired.");
  await audit(adminId, "music.track.retired", id, { status: row.status }, auditView(rows[0]));
  return adminTrack(rows[0]);
}

/** Draft or retired only: removes the row (listening sessions cascade), the audio and the proof. */
export async function deleteTrack(adminId: string, id: string): Promise<{ deleted: true }> {
  const row = await requireTrack(id);
  const p = await musicDb();
  const { rows } = await p.query<{ object_key: string; licence_proof_key: string | null }>(
    `DELETE FROM music.tracks WHERE id = $1 AND status IN ('draft', 'retired') RETURNING object_key, licence_proof_key`,
    [id],
  );
  if (!rows[0]) throw new MusicError(409, "published", "Retire this track before deleting it.");
  await removeObjects([rows[0].object_key, rows[0].licence_proof_key]);
  await audit(adminId, "music.track.deleted", id, auditView(row), undefined);
  return { deleted: true };
}

// ── Preview links ────────────────────────────────────────────────────────────

/** A 5-minute signed link to the audio (any status) or, with `proof`, the licence proof. */
export async function previewUrl(id: string, what: "audio" | "proof"): Promise<{ url: string; expiresAt: string }> {
  const row = await requireTrack(id);
  const objectKey = what === "audio" ? row.object_key : row.licence_proof_key;
  if (!objectKey) throw new MusicError(404, "no_proof", "No licence proof is stored for this track.");
  const signed = createPresignedR2PutUrl({
    method: "GET",
    bucket: musicBucket(),
    objectKey,
    expiresSeconds: MUSIC_PREVIEW_LINK_SECONDS,
  });
  return { url: signed.url, expiresAt: new Date(Date.now() + MUSIC_PREVIEW_LINK_SECONDS * 1000).toISOString() };
}
