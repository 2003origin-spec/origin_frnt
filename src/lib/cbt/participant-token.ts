/**
 * Signed room-bound participant token for the anonymous CBT student surface.
 * jose HS256, bound to {room_id, participant_id, tv (token_version)}. Stored in
 * the HttpOnly `cbt_participant` cookie. Bumping a participant's token_version
 * (on kick) invalidates every outstanding token for them.
 */

import { jwtVerify, SignJWT } from "jose";

export const CBT_PARTICIPANT_COOKIE = "cbt_participant";
export const CBT_PARTICIPANT_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export const CBT_PARTICIPANT_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: CBT_PARTICIPANT_TTL_SECONDS,
};

export type CbtParticipantClaims = {
  room_id: string;
  participant_id: string;
  tv: number;
};

function secret(): Uint8Array {
  const s = process.env.CBT_PARTICIPANT_TOKEN_SECRET?.trim();
  if (!s || s.length < 32) {
    throw new Error("CBT_PARTICIPANT_TOKEN_SECRET must be set and at least 32 characters.");
  }
  return new TextEncoder().encode(s);
}

export async function signParticipantToken(claims: CbtParticipantClaims): Promise<string> {
  return new SignJWT({
    room_id: claims.room_id,
    participant_id: claims.participant_id,
    tv: claims.tv,
    v: 1,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(`${CBT_PARTICIPANT_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifyParticipantToken(token: string): Promise<CbtParticipantClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (
      payload.v !== 1 ||
      typeof payload.room_id !== "string" ||
      typeof payload.participant_id !== "string" ||
      typeof payload.tv !== "number"
    ) {
      return null;
    }
    return { room_id: payload.room_id, participant_id: payload.participant_id, tv: payload.tv };
  } catch {
    return null;
  }
}
