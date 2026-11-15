-- Rollback for 20261114_study_music.sql — removes Study Music (tracks, prefs, listening
-- sessions). The audio and proof files under music/ in the private R2 bucket are NOT
-- deleted by SQL: remove them by hand if the feature is dropped for good.
-- Audit events stay in app.audit_events.

DROP TABLE IF EXISTS music.listen_sessions;

DROP TABLE IF EXISTS music.user_prefs;

DROP TABLE IF EXISTS music.tracks;

DROP SCHEMA IF EXISTS music;

DELETE FROM app.migrations WHERE id = '20261114_study_music';
