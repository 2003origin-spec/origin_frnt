import { randomUUID } from "node:crypto";

/**
 * Prefixed id generator for all cbt.* entities (mirrors the createId convention
 * in db-users.ts). Prefix examples: cbtt (teacher), cbtq (question),
 * cbttest (test), cbtroom (room), cbtp (participant), cbtjob (import job).
 */
export function cbtId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}
