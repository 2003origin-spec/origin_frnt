/**
 * Encryption at rest for KYC identifiers (PAN). AES-256-GCM with a key from
 * NOW_KYC_ENCRYPTION_KEY (32 bytes, base64). Without the key nothing is
 * stored: the caller gets a clear error rather than a silent plaintext write.
 *
 * Format: "v1:<iv b64>:<tag b64>:<ciphertext b64>".
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export class KycEncryptionUnavailableError extends Error {
  constructor() {
    super("KYC encryption is not configured (NOW_KYC_ENCRYPTION_KEY).");
  }
}

function key(): Buffer {
  const raw = process.env.NOW_KYC_ENCRYPTION_KEY?.trim();
  if (!raw) throw new KycEncryptionUnavailableError();
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new KycEncryptionUnavailableError();
  return buf;
}

export function isKycEncryptionConfigured(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

export function encryptKyc(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptKyc(payload: string): string {
  const [version, iv, tag, data] = payload.split(":");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unrecognised KYC payload.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
