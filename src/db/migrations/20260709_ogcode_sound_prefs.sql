-- OGCode answer sound preferences per user
ALTER TABLE origin_users
  ADD COLUMN IF NOT EXISTS ogcode_correct_sound TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ogcode_wrong_sound   TEXT DEFAULT NULL;
