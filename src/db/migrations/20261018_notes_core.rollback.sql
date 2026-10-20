-- Rollback for 20261018_notes_core.sql — removes the whole Origin Notes schema
-- and everything in it (folders, notes, stars, views, reports, uploads, and
-- students' My Notes folders, files and storage meters).
-- Files in the R2 notes bucket are NOT deleted by this; empty the bucket separately.

DROP SCHEMA IF EXISTS notes CASCADE;

DELETE FROM app.migrations WHERE id = '20261018_notes_core';
