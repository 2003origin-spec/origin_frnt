/**
 * Study Music — server-side rules with no database: the error every music
 * handler returns, and the upload token that binds a presigned upload to the
 * admin it was issued to, the object key and the exact size
 * (V1/STUDY_MUSIC_PLAN.md §4.2). Unit-tested in tests/unit/study-music-keys.test.ts.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export class MusicError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    detail: string,
  ) {
    super(detail);
    this.name = "MusicError";
  }
}

/** Matches the presigned PUT (600 s): once the upload link is dead, so is the token. */
export const MUSIC_UPLOAD_TOKEN_TTL_MS = 10 * 60 * 1000;

function tokenKey(): Buffer {
  const secret = process.env.R2_SECRET_ACCESS_KEY?.trim();
  if (!secret) throw new Error("R2_SECRET_ACCESS_KEY is required for music uploads.");
  // Domain-separated from the import upload token (same secret, different label).
  return createHmac("sha256", secret).update("origin:music-upload-token:v1").digest();
}

function tokenSig(userId: string, objectKey: string, size: number, expMs: number): Buffer {
  return createHmac("sha256", tokenKey()).update(`${userId}\n${objectKey}\n${size}\n${expMs}`).digest();
}

/** `<expMs>.<size>.<hex sig>` over `userId\nobjectKey\nsize\nexpMs`. */
export function createMusicUploadToken(userId: string, objectKey: string, size: number, now = Date.now()): string {
  const expMs = now + MUSIC_UPLOAD_TOKEN_TTL_MS;
  return `${expMs}.${size}.${tokenSig(userId, objectKey, size, expMs).toString("hex")}`;
}

/**
 * The size the token was issued for, or null when the token is not an
 * unexpired one minted for this admin and this key. Never throws: a missing
 * secret, a malformed or tampered token all read as "not issued to you".
 */
export function verifyMusicUploadToken(token: unknown, userId: string, objectKey: string, now = Date.now()): number | null {
  if (typeof token !== "string" || !userId || !objectKey) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [expRaw, sizeRaw, sigHex] = parts;
  if (!/^\d{1,16}$/u.test(expRaw) || !/^\d{1,9}$/u.test(sizeRaw) || !/^[0-9a-f]{64}$/u.test(sigHex)) return null;
  const expMs = Number(expRaw);
  const size = Number(sizeRaw);
  if (!Number.isSafeInteger(expMs) || expMs < now || expMs > now + MUSIC_UPLOAD_TOKEN_TTL_MS) return null;
  if (!Number.isSafeInteger(size) || size < 1) return null;
  let expected: Buffer;
  try {
    expected = tokenSig(userId, objectKey, size, expMs);
  } catch {
    return null;
  }
  const given = Buffer.from(sigHex, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected) ? size : null;
}
