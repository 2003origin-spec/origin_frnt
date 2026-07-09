ALTER TABLE origin_users
  DROP COLUMN IF EXISTS ogcode_correct_sound,
  DROP COLUMN IF EXISTS ogcode_wrong_sound;
