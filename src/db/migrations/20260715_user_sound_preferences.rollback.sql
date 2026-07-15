-- Rollback for 20260715_user_sound_preferences.sql
ALTER TABLE origin_users DROP COLUMN IF EXISTS sound_preferences;
