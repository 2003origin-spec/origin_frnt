-- Rollback for 20260713_ogcode_engagement.sql
DROP TABLE IF EXISTS ogcode_friend_challenges;
DROP TABLE IF EXISTS ogcode_question_reports;
DROP TABLE IF EXISTS ogcode_question_likes;
DROP TABLE IF EXISTS ogcode_question_time_buckets;
ALTER TABLE ogcode_questions DROP COLUMN IF EXISTS first_attempt_correct;
ALTER TABLE ogcode_questions DROP COLUMN IF EXISTS first_attempt_total;
ALTER TABLE ogcode_questions DROP COLUMN IF EXISTS correct_time_count;
ALTER TABLE ogcode_questions DROP COLUMN IF EXISTS correct_time_sum;
