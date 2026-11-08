-- 20261022_teacher_code_grant_unique: Flow 1 gives a student exactly ONE free
-- subject per institute. That rule used to be a read-then-insert in
-- grantConnectSubject with no lock, so N parallel POST /api/connect/grant-subject
-- calls (one per subject) all passed the read and all inserted — four free
-- subjects from one code. The old uq_subject_grants_active_workspace index is
-- keyed per SUBJECT, so it never stopped a different subject.
--
-- This partial unique index makes "one active teacher_code grant per
-- (user, workspace)" a database invariant. insertTeacherCodeGrant now uses
-- ON CONFLICT DO NOTHING + re-read, so the losing racer gets the 409 /
-- idempotent path instead of a second grant.
--
-- Mirrored at runtime by ensureSubjectGrantsSchema
-- (src/server/connect/subject-grants-schema.ts), which skips the index (with a
-- warning) rather than failing the whole ensure while duplicates exist.
--
-- BEFORE APPLYING: the index build fails if a user already holds more than one
-- active teacher_code grant for the same institute. Find them first:
--
--   SELECT user_id, workspace_id, COUNT(*) AS active_grants,
--          array_agg(subject ORDER BY created_at) AS subjects,
--          array_agg(id ORDER BY created_at)      AS grant_ids
--     FROM entitlements.subject_grants
--    WHERE source = 'teacher_code' AND status = 'active' AND workspace_id IS NOT NULL
--    GROUP BY user_id, workspace_id
--   HAVING COUNT(*) > 1
--    ORDER BY active_grants DESC;
--
-- The first-created grant is the legitimate pick. To keep it and revoke the
-- rest (review the SELECT above first; then recompute is_premium for the
-- affected users, e.g. via the admin premium-access page or
-- recomputePremiumFlagsForUsers):
--
--   UPDATE entitlements.subject_grants g
--      SET status = 'revoked', updated_at = NOW()
--    WHERE g.source = 'teacher_code' AND g.status = 'active'
--      AND g.workspace_id IS NOT NULL
--      AND EXISTS (
--        SELECT 1 FROM entitlements.subject_grants older
--         WHERE older.user_id = g.user_id AND older.workspace_id = g.workspace_id
--           AND older.source = 'teacher_code' AND older.status = 'active'
--           AND (older.created_at, older.id) < (g.created_at, g.id)
--      )
--   RETURNING g.user_id, g.workspace_id, g.subject;
--
-- Purely additive. Apply AFTER 20260604_phase14_subject_grants.sql.

CREATE UNIQUE INDEX IF NOT EXISTS uq_subject_grants_one_teacher_code
  ON entitlements.subject_grants(user_id, workspace_id)
  WHERE status = 'active' AND source = 'teacher_code' AND workspace_id IS NOT NULL;

INSERT INTO app.migrations (id, name)
VALUES ('20261022_teacher_code_grant_unique', 'one active teacher_code grant per (user, workspace)')
ON CONFLICT (id) DO NOTHING;
