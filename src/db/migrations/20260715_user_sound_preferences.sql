-- App-wide sound-effect preferences (per user) as a single JSONB blob:
--   { correct, wrong, streak3Correct, streak3Wrong, fullScore, badScore,
--     notification, signIn, warning, muted, volume }
-- USER pool (origin_users). Mirrored by the runtime-ensure in db-users.ts.
-- Idempotent + additive; safe to re-run.

ALTER TABLE origin_users ADD COLUMN IF NOT EXISTS sound_preferences JSONB;

-- Backfill from the legacy OGCode correct/wrong columns so existing choices
-- carry over into the new model (other categories fall back to app defaults).
UPDATE origin_users
   SET sound_preferences = jsonb_strip_nulls(
         jsonb_build_object('correct', ogcode_correct_sound, 'wrong', ogcode_wrong_sound)
       )
 WHERE sound_preferences IS NULL
   AND (ogcode_correct_sound IS NOT NULL OR ogcode_wrong_sound IS NOT NULL);
