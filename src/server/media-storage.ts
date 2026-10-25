import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import path from "node:path";

export type UserImagePurpose =
  | "profile_avatar"
  | "memory_booth_source"
  | "memory_booth_card"
  | "cbt_institute_logo"
  | "cbt_question_image"
  | "championship_prize"
  | "workspace_question_image"
  // Diagrams inside Origin Notes typed notes — public like question images
  // (nothing private in them). Note FILES go to the private notes bucket.
  | "notes_diagram";

export type R2UploadInput = {
  userId: string;
  purpose: UserImagePurpose;
  fileName: string;
  mimeType: string;
  body: Buffer;
};

export type R2UploadResult = {
  bucket: string;
  objectKey: string;
  publicUrl: string;
  sha256: string;
  sizeBytes: number;
};

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for Cloudflare R2 image storage.`);
  }
  return value;
}

function r2Endpoint(): string {
  const explicit =
    process.env.R2_ENDPOINT?.trim() || process.env.R2_ENDPOINT_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/u, "");
  const accountId = requiredEnv("R2_ACCOUNT_ID");
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

/**
 * The PUBLIC bucket: images browsers load straight from R2_PUBLIC_BASE_URL
 * (avatars, question images, study materials). Anyone who knows an object key
 * can read it, so nothing private may go here. The import worker writes its
 * question diagrams here too (Cloud Run R2_DEFAULT_BUCKET).
 */
export function publicR2BucketName(): string {
  return process.env.R2_BUCKET_NAME?.trim() || "origin";
}

/**
 * The PRIVATE bucket: files only ever read through short-lived signed links —
 * import source documents, contest proctor frames, Origin NOW KYC documents
 * and store papers. It must have public access off and no custom domain.
 * There is deliberately no fallback: a missing value fails the upload instead
 * of quietly putting the file in the public bucket.
 */
export function privateR2BucketName(): string {
  const bucket = process.env.R2_PRIVATE_BUCKET?.trim();
  if (!bucket) {
    throw new Error("R2_PRIVATE_BUCKET is required for private file storage.");
  }
  if (bucket === publicR2BucketName()) {
    throw new Error("R2_PRIVATE_BUCKET must not be the public image bucket (R2_BUCKET_NAME).");
  }
  return bucket;
}

const ALLOWED_IMPORT_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function isAllowedImportDocumentMimeType(mimeType: string): boolean {
  return ALLOWED_IMPORT_MIME_TYPES.has(mimeType.toLowerCase());
}

/** Largest import source (PDF/DOCX/image) a teacher or admin may upload. */
export const MAX_IMPORT_DOCUMENT_BYTES = 25 * 1024 * 1024;

// Study materials accept the import set plus a few common doc/image/text types.
const ALLOWED_STUDY_MATERIAL_MIME_TYPES = new Set([
  ...ALLOWED_IMPORT_MIME_TYPES,
  "image/gif",
  "application/msword",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
]);

export function isAllowedStudyMaterialMimeType(mimeType: string): boolean {
  return ALLOWED_STUDY_MATERIAL_MIME_TYPES.has(mimeType.toLowerCase());
}

function studyMaterialExtensionForMime(mimeType: string, fileName: string): string {
  const map: Record<string, string> = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/msword": "doc",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "text/plain": "txt",
  };
  const fromMime = map[mimeType.toLowerCase()];
  if (fromMime) return fromMime;
  const ext = path.extname(fileName).replace(".", "").toLowerCase();
  return ext || "bin";
}

/**
 * Upload a study-material file's bytes to Cloudflare R2 (binary lives ONLY in
 * R2; the caller persists just the returned metadata to Postgres). Returns the
 * bucket/objectKey/publicUrl/sha256/sizeBytes for content.study_material_assets.
 * Goes to the PUBLIC bucket: batch students are handed the public URL.
 */
export async function uploadStudyMaterialToR2(input: {
  workspaceId: string;
  batchId: string;
  fileName: string;
  mimeType: string;
  body: Buffer;
}): Promise<R2UploadResult> {
  const mimeType = input.mimeType.toLowerCase();
  if (!isAllowedStudyMaterialMimeType(mimeType)) {
    throw new Error("Unsupported file type. Upload a PDF, DOCX, PPTX, image, or text file.");
  }
  const ext = studyMaterialExtensionForMime(mimeType, input.fileName);
  const now = new Date();
  const objectKey = `study_material/${input.workspaceId}/${input.batchId}/${now.getUTCFullYear()}/${String(
    now.getUTCMonth() + 1,
  ).padStart(2, "0")}/${randomUUID()}.${ext}`;
  return uploadBytesToR2({ objectKey, mimeType, body: input.body, bucket: publicR2BucketName() });
}

export type R2BytesUploadInput = {
  objectKey: string;
  mimeType: string;
  body: Buffer;
  /** Defaults to the private bucket; pass publicR2BucketName() for public files. */
  bucket?: string;
};

export async function uploadBytesToR2(input: R2BytesUploadInput): Promise<R2UploadResult> {
  const mimeType = input.mimeType.toLowerCase();
  if (input.body.length === 0) {
    throw new Error("Uploaded file is empty.");
  }

  const bucket = input.bucket ?? privateR2BucketName();
  const accessKeyId = requiredEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requiredEnv("R2_SECRET_ACCESS_KEY");
  const endpoint = r2Endpoint();
  const payloadHash = createHash("sha256").update(input.body).digest("hex");
  const bodyHash = payloadHash;
  const { amzDate, dateStamp } = amzDateParts();
  const endpointUrl = new URL(endpoint);
  const canonicalUri = canonicalObjectPath(bucket, input.objectKey);
  const requestUrl = new URL(canonicalUri, endpointUrl);
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalHeaders = [
    `content-type:${mimeType}`,
    `host:${requestUrl.host}`,
    `x-amz-content-sha256:${bodyHash}`,
    `x-amz-date:${amzDate}`,
    "",
  ].join("\n");
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    bodyHash,
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");
  const signature = createHmac("sha256", signingKey(secretAccessKey, dateStamp))
    .update(stringToSign, "utf8")
    .digest("hex");

  const requestBody = input.body.buffer.slice(
    input.body.byteOffset,
    input.body.byteOffset + input.body.byteLength,
  ) as ArrayBuffer;

  const response = await fetch(requestUrl, {
    method: "PUT",
    headers: {
      Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "Content-Type": mimeType,
      "X-Amz-Content-Sha256": bodyHash,
      "X-Amz-Date": amzDate,
    },
    body: requestBody,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Cloudflare R2 upload failed (${response.status}).${detail ? ` ${detail.slice(0, 180)}` : ""}`);
  }

  // R2_PUBLIC_BASE_URL serves only the public bucket; a private object has no public URL.
  const publicBase = bucket === publicR2BucketName() ? process.env.R2_PUBLIC_BASE_URL?.trim() : undefined;
  return {
    bucket,
    objectKey: input.objectKey,
    publicUrl: publicBase
      ? buildR2PublicUrl(publicBase, input.objectKey)
      : `r2://${bucket}/${input.objectKey}`,
    sha256: payloadHash,
    sizeBytes: input.body.length,
  };
}

/** RFC3986 encode for SigV4 query params (encodeURIComponent + !'()* ). */
function sigv4Encode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/gu, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** A fresh R2 object key for a browser-side import upload (presigned PUT). */
export function createImportUploadObjectKey(fileName: string): string {
  const safeName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/gu, "_") || "document";
  return `imports/uploads/${randomUUID()}/${safeName}`;
}

const IMPORT_UPLOAD_OBJECT_KEY =
  /^imports\/uploads\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\/(?!\.\.?$)[a-zA-Z0-9._-]+$/u;

/**
 * True only for a key createImportUploadObjectKey could have made. The browser
 * hands the key back when it registers an import job, so it is checked before
 * the import worker is pointed at it — otherwise any object the worker can read
 * (another teacher's paper, a KYC document) could be fed to the import.
 */
export function isImportUploadObjectKey(objectKey: string): boolean {
  return IMPORT_UPLOAD_OBJECT_KEY.test(objectKey);
}

/**
 * True for a byte count a presigned PUT can be signed for: a whole number from
 * 1 to `maxBytes`. The link then accepts a body of exactly that size only.
 */
export function isUploadSize(value: unknown, maxBytes: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= maxBytes;
}

// A bare type/subtype: no parameters or spaces, so the signed value and the
// header the browser sends can't differ by whitespace.
const PLAIN_CONTENT_TYPE = /^[\w.+-]+\/[\w.+-]+$/u;

export type PresignedR2UrlInput = {
  objectKey: string;
  bucket?: string;
  expiresSeconds?: number;
} & (
  | {
      /** Reads an object back (admin proctor photos, Origin NOW downloads). */
      method: "GET";
    }
  | {
      method?: "PUT";
      /** Signed: R2 refuses the upload unless it carries exactly this Content-Type. */
      contentType: string;
      /** Signed: R2 refuses a body of any other length. */
      contentLength: number;
    }
);

/**
 * SigV4 query-presigned URL for R2. A PUT lets the browser upload a large file
 * DIRECTLY to R2, bypassing Vercel's ~4.5 MB serverless request-body limit
 * (which was the real "4 MB PDF" wall).
 *
 * A PUT signs `content-type` and `content-length` as well as `host`, so R2
 * answers 403 unless the upload has exactly the type and size the server
 * approved. The browser sends the returned `headers` and the same File/Blob
 * whose size was signed; it sets Content-Length from the body itself. A GET
 * signs only `host`.
 *
 * Signs against the PRIVATE bucket unless `bucket` is given: a signed link is
 * only ever needed for an object the public can't read.
 *
 * NOTE: a wrong signature only shows against live R2 (403). Smoke test:
 * scripts/smoke-r2-signed-put.ts.
 */
export function createPresignedR2PutUrl(input: PresignedR2UrlInput): {
  url: string;
  bucket: string;
  objectKey: string;
  /** Headers the uploader must send, exactly as given (none for a GET). */
  headers: Record<string, string>;
} {
  const headers: Record<string, string> = {};
  // Lower-case names. R2 rebuilds these from the request it receives.
  const signed: Record<string, string> = {};
  if (input.method !== "GET") {
    if (!PLAIN_CONTENT_TYPE.test(input.contentType)) {
      throw new Error("A presigned upload needs a plain Content-Type such as application/pdf.");
    }
    if (!Number.isSafeInteger(input.contentLength) || input.contentLength < 1) {
      throw new Error("A presigned upload needs the file size in bytes.");
    }
    headers["Content-Type"] = input.contentType;
    signed["content-length"] = String(input.contentLength);
    signed["content-type"] = input.contentType;
  }
  const bucket = input.bucket ?? privateR2BucketName();
  const accessKeyId = requiredEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requiredEnv("R2_SECRET_ACCESS_KEY");
  const endpointUrl = new URL(r2Endpoint());
  signed.host = endpointUrl.host;
  const names = Object.keys(signed).sort();
  const signedHeaders = names.join(";");
  const canonicalHeaders = names.map((name) => `${name}:${signed[name]}\n`).join("");
  const expires = Math.min(Math.max(input.expiresSeconds ?? 600, 60), 3600);
  const { amzDate, dateStamp } = amzDateParts();
  const canonicalUri = canonicalObjectPath(bucket, input.objectKey);
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;

  const params: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": signedHeaders,
  };
  const canonicalQueryString = Object.keys(params)
    .sort()
    .map((k) => `${sigv4Encode(k)}=${sigv4Encode(params[k])}`)
    .join("&");
  const canonicalRequest = [input.method ?? "PUT", canonicalUri, canonicalQueryString, canonicalHeaders, signedHeaders, "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");
  const signature = createHmac("sha256", signingKey(secretAccessKey, dateStamp))
    .update(stringToSign, "utf8")
    .digest("hex");

  return {
    url: `${endpointUrl.origin}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`,
    bucket,
    objectKey: input.objectKey,
    headers,
  };
}

/**
 * Lifetime of an import upload token. Matches the presigned PUT (600 s): once
 * the upload link is dead, the token that registers the job is dead too.
 */
export const IMPORT_UPLOAD_TOKEN_TTL_MS = 10 * 60 * 1000;

/** Domain-separated key from a secret the server already holds; no new env var. */
function importUploadTokenKey(): Buffer {
  return createHmac("sha256", requiredEnv("R2_SECRET_ACCESS_KEY")).update("origin:import-upload-token:v1").digest();
}

function importUploadTokenSig(userId: string, objectKey: string, expMs: number): Buffer {
  return createHmac("sha256", importUploadTokenKey()).update(`${userId}\n${objectKey}\n${expMs}`).digest();
}

/**
 * A stateless HMAC token binding a presigned import upload to the user it was
 * issued to. `<expMs>.<hex sig>` over `userId\nobjectKey\nexpMs`. The browser
 * hands it back with the object key when it registers the import job, so a
 * key presigned for one teacher can't be registered by another, and a key the
 * presign route never issued can't be registered at all.
 */
export function createImportUploadToken(userId: string, objectKey: string, now = Date.now()): string {
  if (!userId) throw new Error("An import upload token needs a user id.");
  const expMs = now + IMPORT_UPLOAD_TOKEN_TTL_MS;
  return `${expMs}.${importUploadTokenSig(userId, objectKey, expMs).toString("hex")}`;
}

/**
 * True only for an unexpired token minted by createImportUploadToken for this
 * user and this key. Never throws: a missing secret, a malformed token or a
 * tampered signature all read as "not issued to you".
 */
export function verifyImportUploadToken(token: unknown, userId: string, objectKey: string, now = Date.now()): boolean {
  if (typeof token !== "string" || !userId || !objectKey) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [expRaw, sigHex] = parts;
  if (!/^\d{1,16}$/u.test(expRaw) || !/^[0-9a-f]{64}$/u.test(sigHex)) return false;
  const expMs = Number(expRaw);
  if (!Number.isSafeInteger(expMs) || expMs < now || expMs > now + IMPORT_UPLOAD_TOKEN_TTL_MS) return false;
  let expected: Buffer;
  try {
    expected = importUploadTokenSig(userId, objectKey, expMs);
  } catch {
    return false;
  }
  const given = Buffer.from(sigHex, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Check a browser's request to upload an import source straight to R2, then
 * sign a PUT for exactly that file: an import type, 1 byte to 25 MB. Throws a
 * message for the user when it can't be signed. Used by both import presign
 * routes (CBT teacher and admin contest). `userId` is the requester: the
 * returned `uploadToken` lets only that user register a job for the key.
 */
export function presignImportUpload(input: { fileName?: unknown; mimeType?: unknown; size?: unknown }, userId: string): {
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
  objectKey: string;
  bucket: string;
  uploadToken: string;
} {
  if (!userId) throw new Error("An import upload needs a signed-in user.");
  const fileName = typeof input.fileName === "string" && input.fileName.trim() ? input.fileName.trim() : "document";
  const mimeType = (typeof input.mimeType === "string" ? input.mimeType : "").toLowerCase();
  if (!isAllowedImportDocumentMimeType(mimeType)) {
    throw new Error("Only PDF, DOCX, JPEG, PNG, or WebP files can be imported.");
  }
  if (typeof input.size === "number" && input.size > MAX_IMPORT_DOCUMENT_BYTES) {
    throw new Error("File is too large (max 25 MB).");
  }
  // A tab opened before sizes were signed sends none.
  if (!isUploadSize(input.size, MAX_IMPORT_DOCUMENT_BYTES)) {
    throw new Error("The file size is missing. Reload the page and try again.");
  }
  const presigned = createPresignedR2PutUrl({
    objectKey: createImportUploadObjectKey(fileName),
    expiresSeconds: 600,
    contentType: mimeType,
    contentLength: input.size,
  });
  return {
    uploadUrl: presigned.url,
    uploadHeaders: presigned.headers,
    objectKey: presigned.objectKey,
    bucket: presigned.bucket,
    uploadToken: createImportUploadToken(userId, presigned.objectKey),
  };
}

export async function uploadImportDocumentToR2(input: {
  jobId: string;
  fileName: string;
  mimeType: string;
  body: Buffer;
}): Promise<R2UploadResult> {
  const mimeType = input.mimeType.toLowerCase();
  if (!isAllowedImportDocumentMimeType(mimeType)) {
    throw new Error("Only PDF, DOCX, JPEG, PNG, or WebP files can be imported.");
  }
  const safeName = path.basename(input.fileName).replace(/[^a-zA-Z0-9._-]/gu, "_") || "document";
  const objectKey = `imports/${input.jobId}/${safeName}`;
  return uploadBytesToR2({
    objectKey,
    mimeType,
    body: input.body,
    bucket: privateR2BucketName(),
  });
}

function r2PublicBaseUrl(): string {
  return requiredEnv("R2_PUBLIC_BASE_URL").replace(/\/+$/u, "");
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/gu, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function canonicalObjectPath(bucket: string, objectKey: string): string {
  return `/${[bucket, ...objectKey.split("/")].map(encodePathSegment).join("/")}`;
}

export function buildR2PublicUrl(publicBaseUrl: string, objectKey: string): string {
  return `${publicBaseUrl.replace(/\/+$/u, "")}/${objectKey.split("/").map(encodePathSegment).join("/")}`;
}

export function isAllowedUserImageMimeType(mimeType: string): boolean {
  return ALLOWED_IMAGE_MIME_TYPES.has(mimeType.toLowerCase());
}

function extensionForImage(fileName: string, mimeType: string): string {
  const fromName = path.extname(fileName).toLowerCase().replace(/[^a-z0-9.]/gu, "");
  if ([".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(fromName)) return fromName.slice(1);
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  return "bin";
}

export function createR2ObjectKey(input: Pick<R2UploadInput, "userId" | "purpose" | "fileName" | "mimeType">): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const userId = input.userId.replace(/[^a-zA-Z0-9_-]/gu, "_");
  const ext = extensionForImage(input.fileName, input.mimeType);
  return `${input.purpose}/${userId}/${year}/${month}/${randomUUID()}.${ext}`;
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function signingKey(secretAccessKey: string, dateStamp: string): Buffer {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, "auto");
  const serviceKey = hmac(regionKey, "s3");
  return hmac(serviceKey, "aws4_request");
}

function amzDateParts(now = new Date()): { amzDate: string; dateStamp: string } {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/gu, "");
  return {
    amzDate: iso,
    dateStamp: iso.slice(0, 8),
  };
}

export async function uploadImageToR2(input: R2UploadInput): Promise<R2UploadResult> {
  const mimeType = input.mimeType.toLowerCase();
  if (!isAllowedUserImageMimeType(mimeType)) {
    throw new Error("Only JPEG, PNG, WebP, or GIF images can be uploaded.");
  }
  if (input.body.length === 0) {
    throw new Error("Uploaded image is empty.");
  }

  const bucket = requiredEnv("R2_BUCKET_NAME");
  const accessKeyId = requiredEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requiredEnv("R2_SECRET_ACCESS_KEY");
  const endpoint = r2Endpoint();
  const objectKey = createR2ObjectKey(input);
  const payloadHash = createHash("sha256").update(input.body).digest("hex");
  const bodyHash = payloadHash;
  const { amzDate, dateStamp } = amzDateParts();
  const endpointUrl = new URL(endpoint);
  const canonicalUri = canonicalObjectPath(bucket, objectKey);
  const requestUrl = new URL(canonicalUri, endpointUrl);
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalHeaders = [
    `content-type:${mimeType}`,
    `host:${requestUrl.host}`,
    `x-amz-content-sha256:${bodyHash}`,
    `x-amz-date:${amzDate}`,
    "",
  ].join("\n");
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    bodyHash,
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");
  const signature = createHmac("sha256", signingKey(secretAccessKey, dateStamp))
    .update(stringToSign, "utf8")
    .digest("hex");

  const requestBody = input.body.buffer.slice(
    input.body.byteOffset,
    input.body.byteOffset + input.body.byteLength,
  ) as ArrayBuffer;

  const response = await fetch(requestUrl, {
    method: "PUT",
    headers: {
      "Authorization": `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "Content-Type": mimeType,
      "X-Amz-Content-Sha256": bodyHash,
      "X-Amz-Date": amzDate,
    },
    body: requestBody,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Cloudflare R2 upload failed (${response.status}).${detail ? ` ${detail.slice(0, 180)}` : ""}`);
  }

  return {
    bucket,
    objectKey,
    publicUrl: buildR2PublicUrl(r2PublicBaseUrl(), objectKey),
    sha256: payloadHash,
    sizeBytes: input.body.length,
  };
}

/**
 * Permanently delete an object from R2 (SigV4 DELETE, empty payload).
 *
 * Used when an import job is deleted: the job row goes, so nothing would ever
 * read the source document again and leaving it behind just accrues storage.
 * S3/R2 DELETE is idempotent — a missing key still answers 204 — so a retry or
 * a double-delete is not an error. Callers should treat a throw here as
 * non-fatal: the DB row is the source of truth, an orphaned blob is not.
 * Defaults to the private bucket, like createPresignedR2PutUrl.
 */
export async function deleteR2Object(input: { bucket?: string; objectKey: string }): Promise<void> {
  const bucket = input.bucket?.trim() || privateR2BucketName();
  const response = await signedR2Request({ method: "DELETE", bucket, objectKey: input.objectKey });

  // 404 is a success for our purposes: the object is gone either way.
  if (!response.ok && response.status !== 404) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Cloudflare R2 delete failed (${response.status}).${detail ? ` ${detail.slice(0, 180)}` : ""}`);
  }
}

/**
 * A header-signed (SigV4) R2 request with an empty body: one object when
 * `objectKey` is set, the bucket itself otherwise (listings). `headers` are
 * extra x-amz-* headers (lower-case names) that get signed and sent.
 */
async function signedR2Request(input: {
  method: "GET" | "HEAD" | "PUT" | "DELETE";
  bucket: string;
  objectKey?: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
}): Promise<Response> {
  const accessKeyId = requiredEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requiredEnv("R2_SECRET_ACCESS_KEY");
  const endpointUrl = new URL(r2Endpoint());
  const { amzDate, dateStamp } = amzDateParts();
  const canonicalUri =
    input.objectKey === undefined
      ? `/${encodePathSegment(input.bucket)}`
      : canonicalObjectPath(input.bucket, input.objectKey);
  const query = input.query ?? {};
  const canonicalQueryString = Object.keys(query)
    .sort()
    .map((k) => `${sigv4Encode(k)}=${sigv4Encode(query[k])}`)
    .join("&");
  const payloadHash = createHash("sha256").update("").digest("hex");
  const amzHeaders: Record<string, string> = {
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...input.headers,
  };
  const signed: Record<string, string> = { host: endpointUrl.host, ...amzHeaders };
  const names = Object.keys(signed).sort();
  const canonicalHeaders = names.map((name) => `${name}:${signed[name].trim()}\n`).join("");
  const signedHeaders = names.join(";");
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const canonicalRequest = [input.method, canonicalUri, canonicalQueryString, canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");
  const signature = createHmac("sha256", signingKey(secretAccessKey, dateStamp))
    .update(stringToSign, "utf8")
    .digest("hex");

  return fetch(`${endpointUrl.origin}${canonicalUri}${canonicalQueryString ? `?${canonicalQueryString}` : ""}`, {
    method: input.method,
    headers: {
      Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      ...amzHeaders,
    },
  });
}

export type R2ObjectInfo = { key: string; sizeBytes: number; etag: string };

function decodeXmlText(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/giu, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/gu, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&amp;/gu, "&");
}

function xmlTag(xml: string, tag: string): string | null {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "u").exec(xml);
  return match ? decodeXmlText(match[1]) : null;
}

/** Pure: one page of an S3 ListObjectsV2 XML response. */
export function parseListObjectsV2(xml: string): { objects: R2ObjectInfo[]; nextContinuationToken: string | null } {
  const objects: R2ObjectInfo[] = [];
  for (const [, block] of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/gu)) {
    const key = xmlTag(block, "Key");
    if (key === null) continue;
    objects.push({ key, sizeBytes: Number(xmlTag(block, "Size") ?? 0), etag: xmlTag(block, "ETag") ?? "" });
  }
  const truncated = xmlTag(xml, "IsTruncated") === "true";
  return { objects, nextContinuationToken: truncated ? xmlTag(xml, "NextContinuationToken") : null };
}

/** Every object under `prefix` in `bucket` (ListObjectsV2, 1000 per page). */
export async function listR2Objects(input: { bucket: string; prefix: string }): Promise<R2ObjectInfo[]> {
  const all: R2ObjectInfo[] = [];
  let token: string | null = null;
  do {
    const query: Record<string, string> = { "list-type": "2", prefix: input.prefix };
    if (token) query["continuation-token"] = token;
    const response = await signedR2Request({ method: "GET", bucket: input.bucket, query });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`Cloudflare R2 list failed (${response.status}). ${body.slice(0, 180)}`);
    }
    const page = parseListObjectsV2(body);
    all.push(...page.objects);
    token = page.nextContinuationToken;
  } while (token);
  return all;
}

/** Size and ETag of one object, or null when it doesn't exist. */
export async function headR2Object(input: { bucket: string; objectKey: string }): Promise<{ sizeBytes: number; etag: string } | null> {
  const response = await signedR2Request({ method: "HEAD", bucket: input.bucket, objectKey: input.objectKey });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Cloudflare R2 head failed (${response.status}).`);
  return {
    sizeBytes: Number(response.headers.get("content-length") ?? 0),
    etag: response.headers.get("etag") ?? "",
  };
}

/** Server-side copy of one object to the same key in another bucket (metadata kept). */
export async function copyR2Object(input: { fromBucket: string; toBucket: string; objectKey: string }): Promise<void> {
  const copySource = canonicalObjectPath(input.fromBucket, input.objectKey).slice(1);
  const response = await signedR2Request({
    method: "PUT",
    bucket: input.toBucket,
    objectKey: input.objectKey,
    headers: { "x-amz-copy-source": copySource },
  });
  // S3 can answer 200 with an <Error> body when a copy fails part-way.
  const body = await response.text().catch(() => "");
  if (!response.ok || body.includes("<Error>")) {
    throw new Error(`Cloudflare R2 copy failed (${response.status}).${body ? ` ${body.slice(0, 180)}` : ""}`);
  }
}
