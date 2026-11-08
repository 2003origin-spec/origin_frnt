/**
 * AWS Signature V4 for R2's S3 API — pure functions, no I/O, no env.
 *
 * Origin's existing helpers (src/server/media-storage.ts) hand-roll SigV4 per
 * call and sign only `host` on presigned URLs. Notes needs a few more shapes —
 * HEAD, ranged GET, server-side COPY, presigned GETs with response-header
 * overrides, and presigned PUTs bound to a Content-Type — so they live here as
 * one general signer. Unit-tested against AWS's published S3 examples in
 * tests/notes/r2-sigv4.test.ts (region "us-east-1" there; R2 uses "auto").
 */

import { createHash, createHmac } from "node:crypto";

export type SigV4Credentials = {
  accessKeyId: string;
  secretAccessKey: string;
  /** "auto" for Cloudflare R2. */
  region: string;
  service?: string;
};

export const EMPTY_PAYLOAD_SHA256 = createHash("sha256").update("").digest("hex");

/** RFC 3986 percent-encoding (encodeURIComponent plus !'()*). */
export function sigv4Encode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/gu, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** Path-style object path `/bucket/key/with/slashes`, each segment encoded. */
export function canonicalObjectPath(bucket: string, objectKey: string): string {
  return `/${[bucket, ...objectKey.split("/")].map(sigv4Encode).join("/")}`;
}

export function amzDateParts(now: Date): { amzDate: string; dateStamp: string } {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/gu, "");
  return { amzDate, dateStamp: amzDate.slice(0, 8) };
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

export function signingKey(secretAccessKey: string, dateStamp: string, region: string, service: string): Buffer {
  return hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), service), "aws4_request");
}

function canonicalQuery(params: Record<string, string>): string {
  return Object.keys(params)
    .map((key) => [sigv4Encode(key), sigv4Encode(params[key])] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

function canonicalHeaderBlock(headers: Record<string, string>): { block: string; signed: string } {
  const entries = Object.entries(headers)
    .map(([name, value]) => [name.toLowerCase(), value.trim().replace(/\s+/gu, " ")] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return {
    block: entries.map(([name, value]) => `${name}:${value}\n`).join(""),
    signed: entries.map(([name]) => name).join(";"),
  };
}

function signature(
  credentials: SigV4Credentials,
  amzDate: string,
  dateStamp: string,
  canonicalRequest: string,
): { scope: string; value: string } {
  const service = credentials.service ?? "s3";
  const scope = `${dateStamp}/${credentials.region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");
  const value = createHmac("sha256", signingKey(credentials.secretAccessKey, dateStamp, credentials.region, service))
    .update(stringToSign, "utf8")
    .digest("hex");
  return { scope, value };
}

export type PresignInput = {
  method: "GET" | "PUT" | "HEAD" | "DELETE";
  /** Scheme + host (+ port), e.g. `https://<account>.r2.cloudflarestorage.com`. */
  origin: string;
  canonicalUri: string;
  credentials: SigV4Credentials;
  expiresSeconds: number;
  /** Extra signed query params, e.g. `response-content-disposition`. */
  query?: Record<string, string>;
  /** Extra headers the client MUST send verbatim (e.g. `content-type`). */
  signedHeaders?: Record<string, string>;
  now?: Date;
};

/** Query-string presigned URL (payload unsigned), as S3/R2 accept for browser PUT/GET. */
export function presignUrl(input: PresignInput): string {
  const now = input.now ?? new Date();
  const { amzDate, dateStamp } = amzDateParts(now);
  const host = new URL(input.origin).host;
  const headers = canonicalHeaderBlock({ host, ...(input.signedHeaders ?? {}) });
  const service = input.credentials.service ?? "s3";
  const scope = `${dateStamp}/${input.credentials.region}/${service}/aws4_request`;
  const params: Record<string, string> = {
    ...(input.query ?? {}),
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${input.credentials.accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(input.expiresSeconds),
    "X-Amz-SignedHeaders": headers.signed,
  };
  const query = canonicalQuery(params);
  const canonicalRequest = [input.method, input.canonicalUri, query, headers.block, headers.signed, "UNSIGNED-PAYLOAD"].join("\n");
  const sig = signature(input.credentials, amzDate, dateStamp, canonicalRequest);
  return `${input.origin.replace(/\/+$/u, "")}${input.canonicalUri}?${query}&X-Amz-Signature=${sig.value}`;
}

export type SignedRequestInput = {
  method: "GET" | "PUT" | "HEAD" | "DELETE";
  origin: string;
  canonicalUri: string;
  credentials: SigV4Credentials;
  /** Headers to sign and send (besides host / x-amz-date / x-amz-content-sha256). */
  headers?: Record<string, string>;
  query?: Record<string, string>;
  /** Hex SHA-256 of the body; EMPTY_PAYLOAD_SHA256 for no body. */
  payloadHash?: string;
  now?: Date;
};

/** Header-signed request: returns the URL and the full header set to send. */
export function signRequest(input: SignedRequestInput): { url: string; headers: Record<string, string> } {
  const now = input.now ?? new Date();
  const { amzDate, dateStamp } = amzDateParts(now);
  const host = new URL(input.origin).host;
  const payloadHash = input.payloadHash ?? EMPTY_PAYLOAD_SHA256;
  const toSign: Record<string, string> = {
    ...(input.headers ?? {}),
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  const headers = canonicalHeaderBlock(toSign);
  const query = input.query ? canonicalQuery(input.query) : "";
  const canonicalRequest = [input.method, input.canonicalUri, query, headers.block, headers.signed, payloadHash].join("\n");
  const sig = signature(input.credentials, amzDate, dateStamp, canonicalRequest);
  const outgoing: Record<string, string> = { ...(input.headers ?? {}) };
  outgoing["x-amz-content-sha256"] = payloadHash;
  outgoing["x-amz-date"] = amzDate;
  outgoing.Authorization = `AWS4-HMAC-SHA256 Credential=${input.credentials.accessKeyId}/${sig.scope}, SignedHeaders=${headers.signed}, Signature=${sig.value}`;
  const base = `${input.origin.replace(/\/+$/u, "")}${input.canonicalUri}`;
  return { url: query ? `${base}?${query}` : base, headers: outgoing };
}
