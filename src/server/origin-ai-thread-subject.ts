import { getThreadById } from "@/server/origin-ai";
import { withStoreAsyncScoped } from "@/server/store";
import { ensureAppStoreSchema } from "@/server/store-postgres";
import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";

// Same row getThreadById picks from a hydrated store: the user's newest
// (created_at DESC, the hydrate order) app.origin_ai_sessions row carrying
// this thread id. Served by idx_origin_ai_sessions_user_created.
export const THREAD_SUBJECT_SQL = `SELECT data->>'subject' AS subject
     FROM app.origin_ai_sessions
    WHERE user_id = $1 AND data->>'threadId' = $2
    ORDER BY created_at DESC
    LIMIT 1`;

/**
 * The subject the local app store holds for one of the user's Ori threads, or
 * null. This used to be a full-store hydration (every user's rows in 18 tables)
 * just to read one field. With the Ori microservice on, threads normally live in
 * origin_ai.sessions there (and origin-ai prefers its own session.subject), so
 * this usually finds nothing; it still covers threads created through the
 * in-app fallback. Unlike a store hydrate, it does not fall back to the legacy
 * seed's originAiSessions when app.origin_ai_sessions is empty; a thread held
 * only there gets null here and the caller uses the page's activeSubject, so
 * the worst case is a less precise KB scope, never a refused question.
 * Best-effort enrichment: a failed lookup is logged and treated
 * as "no subject" rather than failing the student's question.
 */
export async function findLocalThreadSubject(userId: string, threadId: string): Promise<string | null> {
  if (!isUserPostgresConfigured()) {
    return withStoreAsyncScoped((store) => getThreadById(store, userId, threadId)?.subject ?? null, null);
  }
  try {
    const pool = getUserPostgresPool();
    if (!pool) return null;
    await ensureAppStoreSchema();
    const result = await pool.query(THREAD_SUBJECT_SQL, [userId, threadId]);
    const subject: unknown = result.rows[0]?.subject;
    return typeof subject === "string" ? subject : null;
  } catch (error) {
    console.error("[origin-ai] thread subject lookup failed", error instanceof Error ? error.message : error);
    return null;
  }
}
