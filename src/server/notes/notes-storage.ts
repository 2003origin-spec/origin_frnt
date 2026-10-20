/**
 * Origin Notes — file storage in a PRIVATE R2 bucket (V1/NOTES_PLAN.md §8, §10).
 *
 * Notes files never go in the bucket that serves public images
 * (`R2_BUCKET_NAME`). They live in `R2_NOTES_BUCKET`, which must have no public
 * domain, and are only ever reached through short-lived signed links handed
 * out after an access check. Endpoint and keys are the shared R2 ones
 * (`R2_ENDPOINT`/`R2_ENDPOINT_URL` or `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
 * `R2_SECRET_ACCESS_KEY`).
 *
 * The bucket needs CORS for the site's origins: PUT (browser uploads), GET
 * (pdf.js fetches PDFs) and HEAD, the `Range` and `Content-Type` request
 * headers, and exposed `Content-Length`, `Content-Range`, `Accept-Ranges`,
 * `ETag`. For local work, scripts/dev-fake-r2.mjs stands in for R2.
 */

import { createHash } from "node:crypto";

import { NotesError } from "./notes-errors";
import {
  EMPTY_PAYLOAD_SHA256,
  canonicalObjectPath,
  presignUrl,
  signRequest,
  type SigV4Credentials,
} from "./r2-sigv4";

type R2Config = { origin: string; bucket: string; credentials: SigV4Credentials };

function env(name: string): string | null {
  return process.env[name]?.trim() || null;
}

function readConfig(): R2Config | null {
  const bucket = env("R2_NOTES_BUCKET");
  const accessKeyId = env("R2_ACCESS_KEY_ID");
  const secretAccessKey = env("R2_SECRET_ACCESS_KEY");
  const endpoint = env("R2_ENDPOINT") ?? env("R2_ENDPOINT_URL");
  const accountId = env("R2_ACCOUNT_ID");
  const origin = endpoint ? endpoint.replace(/\/+$/u, "") : accountId ? `https://${accountId}.r2.cloudflarestorage.com` : null;
  if (!bucket || !accessKeyId || !secretAccessKey || !origin) return null;
  return { origin, bucket, credentials: { accessKeyId, secretAccessKey, region: "auto", service: "s3" } };
}

export function isNotesStorageConfigured(): boolean {
  return readConfig() !== null;
}

function config(): R2Config {
  const cfg = readConfig();
  if (!cfg) {
    throw new NotesError(
      503,
      "storage_not_configured",
      "File uploads are not set up yet. Ask the team to create the private notes bucket (R2_NOTES_BUCKET).",
    );
  }
  return cfg;
}

function clampExpiry(seconds: number): number {
  return Math.min(Math.max(Math.round(seconds), 60), 3600);
}

/**
 * Browser upload link. The browser must send exactly this Content-Type AND
 * exactly `contentLength` bytes, or R2 refuses it: the link can't carry a
 * bigger or different-sized file than the one that was checked and reserved.
 */
export function presignNotesPut(objectKey: string, contentType: string, contentLength: number, expiresSeconds = 900): string {
  const cfg = config();
  return presignUrl({
    method: "PUT",
    origin: cfg.origin,
    canonicalUri: canonicalObjectPath(cfg.bucket, objectKey),
    credentials: cfg.credentials,
    expiresSeconds: clampExpiry(expiresSeconds),
    signedHeaders: { "content-type": contentType, "content-length": String(Math.round(contentLength)) },
  });
}

/** Read link with a fixed content type and a safe file name. */
export function presignNotesGet(
  objectKey: string,
  options: { contentType: string; fileName: string; download?: boolean; expiresSeconds?: number },
): string {
  const cfg = config();
  // Plain `filename` must be ASCII; `filename*` carries the real (Unicode) name.
  const asciiName = options.fileName.replace(/[^\x20-\x7e]/gu, "_").replace(/["\\]/gu, "");
  const disposition = `${options.download ? "attachment" : "inline"}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(options.fileName)}`;
  return presignUrl({
    method: "GET",
    origin: cfg.origin,
    canonicalUri: canonicalObjectPath(cfg.bucket, objectKey),
    credentials: cfg.credentials,
    expiresSeconds: clampExpiry(options.expiresSeconds ?? 600),
    query: {
      "response-content-type": options.contentType,
      "response-content-disposition": disposition,
      "response-cache-control": "private, max-age=600",
    },
  });
}

async function send(
  method: "GET" | "PUT" | "HEAD" | "DELETE",
  objectKey: string,
  headers: Record<string, string> = {},
  body?: Buffer,
): Promise<Response> {
  const cfg = config();
  const payloadHash = body ? createHash("sha256").update(body).digest("hex") : EMPTY_PAYLOAD_SHA256;
  const signed = signRequest({
    method,
    origin: cfg.origin,
    canonicalUri: canonicalObjectPath(cfg.bucket, objectKey),
    credentials: cfg.credentials,
    headers,
    payloadHash,
  });
  return fetch(signed.url, {
    method,
    headers: signed.headers,
    body: body ? (body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer) : undefined,
    cache: "no-store",
  });
}

async function failure(action: string, response: Response): Promise<Error> {
  const detail = await response.text().catch(() => "");
  return new Error(`R2 ${action} failed (${response.status}).${detail ? ` ${detail.slice(0, 160)}` : ""}`);
}

export type NotesObjectInfo = { bytes: number; contentType: string | null; etag: string | null };

/** Size and type of a stored object, or null when it does not exist. */
export async function headNotesObject(objectKey: string): Promise<NotesObjectInfo | null> {
  const response = await send("HEAD", objectKey);
  if (response.status === 404) return null;
  if (!response.ok) throw await failure("HEAD", response);
  const length = Number(response.headers.get("content-length"));
  return {
    bytes: Number.isFinite(length) ? length : 0,
    contentType: response.headers.get("content-type"),
    etag: response.headers.get("etag"),
  };
}

/** Thrown when the object changed after it was checked (its ETag moved). */
export class NotesObjectChangedError extends Error {}

/**
 * The first `length` bytes of an object (for the magic-byte check). With
 * `ifMatch`, the read only succeeds if the object is still the one HEAD saw.
 */
export async function readNotesObjectStart(objectKey: string, length: number, ifMatch?: string | null): Promise<Uint8Array> {
  const response = await send("GET", objectKey, { range: `bytes=0-${Math.max(0, length - 1)}`, ...(ifMatch ? { "if-match": ifMatch } : {}) });
  if (response.status === 412) throw new NotesObjectChangedError("The object changed while it was being checked.");
  if (!response.ok) throw await failure("ranged GET", response);
  const buffer = new Uint8Array(await response.arrayBuffer());
  return buffer.subarray(0, length);
}

/**
 * Server-side copy within the notes bucket (no bytes pass through Vercel).
 * With `ifMatch`, R2 copies only if the source is still exactly the object
 * that was checked — a file swapped in through the upload link is refused.
 */
export async function copyNotesObject(fromKey: string, toKey: string, ifMatch?: string | null): Promise<void> {
  const cfg = config();
  const response = await send("PUT", toKey, {
    "x-amz-copy-source": canonicalObjectPath(cfg.bucket, fromKey),
    ...(ifMatch ? { "x-amz-copy-source-if-match": ifMatch } : {}),
  });
  if (response.status === 412) throw new NotesObjectChangedError("The object changed while it was being copied.");
  if (!response.ok) throw await failure("COPY", response);
  // S3 can answer 200 with an <Error> body for a failed copy.
  const text = await response.text().catch(() => "");
  if (/<Code>PreconditionFailed<\/Code>/u.test(text)) throw new NotesObjectChangedError("The object changed while it was being copied.");
  if (/<Error>/u.test(text)) throw new Error(`R2 COPY failed. ${text.slice(0, 160)}`);
}

/** Idempotent delete — a missing object counts as deleted. */
export async function deleteNotesObject(objectKey: string): Promise<void> {
  const response = await send("DELETE", objectKey);
  if (!response.ok && response.status !== 404) throw await failure("DELETE", response);
}

/** Small server-side write (used only by the storage self-check). */
export async function putNotesObject(objectKey: string, body: Buffer, contentType: string): Promise<void> {
  const response = await send("PUT", objectKey, { "content-type": contentType }, body);
  if (!response.ok) throw await failure("PUT", response);
}

/** Where a checked file lives: notes/library/2026/10/<itemId>.<ext>. */
export function libraryObjectKey(itemId: string, ext: string, now = new Date()): string {
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `notes/library/${now.getUTCFullYear()}/${month}/${itemId}.${ext}`;
}

/** Where an upload lands before it is checked. */
export function uploadObjectKey(uploadId: string): string {
  return `notes/uploads/${uploadId}`;
}
