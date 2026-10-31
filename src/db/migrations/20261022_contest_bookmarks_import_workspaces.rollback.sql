-- Rollback for 20261022_contest_bookmarks_import_workspaces.sql (USER database).
-- Drops the two tables and every bookmark / cached admin import workspace id
-- they hold. The hidden [CONTEST] teacher workspaces themselves (in
-- app.teacher_workspaces) are left in place. The index goes with its table.

DROP TABLE IF EXISTS contest.question_bookmarks;
DROP TABLE IF EXISTS contest.admin_import_workspaces;
