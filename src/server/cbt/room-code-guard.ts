import { isWithinLimit, type AppRateLimiter } from "@/lib/rate-limit";

/**
 * Wrong-room-code brute-force guard for the CBT join route (join + reclaim,
 * which both check the room code).
 *
 * The attempt ALWAYS runs: a correct code always gets in, however many wrong
 * codes have come from the same (NAT IP, room) key. Only a 403 (incorrect room
 * code) spends the budget, and once the budget is spent further WRONG codes
 * come back as 429 instead of 403. The budget is not read before the attempt,
 * because a whole computer lab shares one NAT IP: a pre-check let one student
 * (or a class's typos) lock every classmate out of the exam, including crash
 * reclaims, even with the right code.
 *
 * Why that is still safe: the 429 only slows the guesser down, it does not
 * stop them — the real cap on guessing is the throughput limiter
 * (cbtJoinLimiter, 120 per 10 min per (ip, room)), roughly 17k guesses a day
 * against a 6-character code from a 32-letter alphabet (~10^9 codes). Honest
 * misses like "room closed" or "enter your name" never count.
 */
export type RoomCodeGuardResult<T> = { locked: true } | { locked: false; value: T };

export async function withRoomCodeGuard<T>(
  failureLimiter: AppRateLimiter,
  key: string,
  attempt: () => Promise<T>,
): Promise<RoomCodeGuardResult<T>> {
  try {
    return { locked: false, value: await attempt() };
  } catch (error) {
    if ((error as { status?: number } | null)?.status === 403) {
      // Budget spent (or a fail-closed backend error) → refuse this wrong code with 429.
      if (!(await isWithinLimit(failureLimiter, key))) return { locked: true };
    }
    throw error;
  }
}

export const ROOM_CODE_LOCKED_DETAIL = "Too many incorrect room codes. Please wait a while and try again.";
