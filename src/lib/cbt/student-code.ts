/**
 * Student identity + room-link generation for the anonymous CBT student surface.
 * Student codes are shown as `CBT-XXXXXX` (Crockford alphabet, unique per room).
 * Room slugs are 128 bits of entropy (unguessable).
 */

import { randomBytes, randomInt } from "node:crypto";

import { ROOM_CODE_ALPHABET } from "@/lib/study-rooms/code";

const STUDENT_CODE_LENGTH = 6;
export const STUDENT_CODE_PREFIX = "CBT-";

/** Raw 6-char student code (no prefix). */
function randomStudentBody(length = STUDENT_CODE_LENGTH): string {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += ROOM_CODE_ALPHABET[randomInt(0, ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

/** Full student ID as shown to the student and written to the export, e.g. CBT-7F3K9Q. */
export function generateStudentCode(): string {
  return `${STUDENT_CODE_PREFIX}${randomStudentBody()}`;
}

/** Normalizes a student-entered code (case + prefix + whitespace tolerant). */
export function normalizeStudentCode(input: string): string {
  const cleaned = input.trim().toUpperCase().replace(/\s+/g, "");
  const body = cleaned.startsWith(STUDENT_CODE_PREFIX) ? cleaned.slice(STUDENT_CODE_PREFIX.length) : cleaned;
  return `${STUDENT_CODE_PREFIX}${body}`;
}

/** 128-bit unguessable public room slug (URL-safe). */
export function generateRoomSlug(): string {
  return randomBytes(16).toString("base64url");
}
