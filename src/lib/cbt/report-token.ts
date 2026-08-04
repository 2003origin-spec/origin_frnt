/**
 * Short-lived, room-and-participant-bound token for the public CBT report card.
 *
 * Deliberately a SEPARATE token from the attempt's participant token, with its
 * own cookie name and an explicit `purpose` claim. The two must never be
 * interchangeable: a report token would otherwise be usable to autosave or
 * submit answers, and an attempt token to read the answer key.
 *
 * Two hours is long enough to read a report, print it and re-open it, and short
 * enough that a link opened on a shared/lab machine doesn't stay unlocked.
 */

import { jwtVerify, SignJWT } from "jose";

export const CBT_REPORT_COOKIE = "cbt_report";
export const CBT_REPORT_TTL_SECONDS = 2 * 60 * 60; // 2 hours

export const CBT_REPORT_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: CBT_REPORT_TTL_SECONDS,
};

const REPORT_PURPOSE = "report";

export type CbtReportClaims = {
  room_id: string;
  participant_id: string;
};

function secret(): Uint8Array {
  const s = process.env.CBT_PARTICIPANT_TOKEN_SECRET?.trim();
  if (!s || s.length < 32) {
    throw new Error("CBT_PARTICIPANT_TOKEN_SECRET must be set and at least 32 characters.");
  }
  return new TextEncoder().encode(s);
}

export async function signReportToken(claims: CbtReportClaims): Promise<string> {
  return new SignJWT({
    room_id: claims.room_id,
    participant_id: claims.participant_id,
    purpose: REPORT_PURPOSE,
    v: 1,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(`${CBT_REPORT_TTL_SECONDS}s`)
    .sign(secret());
}

/**
 * Verifies a report token. The `purpose` check is what stops an attempt token —
 * which is signed with the same secret — from being replayed here.
 */
export async function verifyReportToken(token: string | undefined): Promise<CbtReportClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (
      payload.v !== 1 ||
      payload.purpose !== REPORT_PURPOSE ||
      typeof payload.room_id !== "string" ||
      typeof payload.participant_id !== "string"
    ) {
      return null;
    }
    return { room_id: payload.room_id, participant_id: payload.participant_id };
  } catch {
    return null;
  }
}
