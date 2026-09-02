-- Contest document-import bank flags.
--
-- Adds two flags to the OGCode question bank so questions imported (from a file)
-- on the Contest admin side can be (a) hidden from general OGCode student
-- surfaces while remaining usable by the contest paper/resolver, and (b) opted
-- per-question into the contest practice + DPP recommendation pools.
--
-- Purely additive + idempotent. Mirrored by ensureCatalogSchema()
-- (src/server/ogcode-catalog.ts). Targets the OGCODE database.

ALTER TABLE ogcode_questions ADD COLUMN IF NOT EXISTS is_contest_import BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE ogcode_questions ADD COLUMN IF NOT EXISTS contest_practice_eligible BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS ogcode_questions_contest_import_idx ON ogcode_questions (is_contest_import);
