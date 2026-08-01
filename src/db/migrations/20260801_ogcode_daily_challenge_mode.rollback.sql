-- Rollback for 20260801_ogcode_daily_challenge_mode.sql
--
-- Reverting to one challenge per DAY requires collapsing the per-mode rows first,
-- otherwise the single-column primary key cannot be restored. We keep the 'neet'
-- row for each date where one exists (that is what the pre-migration selector
-- would have picked, since the old pool was Physics+NEET), else the lowest mode
-- alphabetically, so the choice is deterministic.

DELETE FROM ogcode_daily_challenges d
 WHERE EXISTS (
   SELECT 1 FROM ogcode_daily_challenges k
    WHERE k.challenge_date = d.challenge_date
      AND (k.mode = 'neet') > (d.mode = 'neet')
 )
    OR EXISTS (
   SELECT 1 FROM ogcode_daily_challenges k
    WHERE k.challenge_date = d.challenge_date
      AND (k.mode = 'neet') = (d.mode = 'neet')
      AND k.mode < d.mode
 );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_index i
     WHERE i.indrelid = 'ogcode_daily_challenges'::regclass
       AND i.indisprimary
       AND i.indnatts = 2
  ) THEN
    ALTER TABLE ogcode_daily_challenges DROP CONSTRAINT ogcode_daily_challenges_pkey;
    ALTER TABLE ogcode_daily_challenges ADD PRIMARY KEY (challenge_date);
  END IF;
END $$;

ALTER TABLE ogcode_daily_challenges DROP CONSTRAINT IF EXISTS ogcode_daily_challenges_mode_check;
ALTER TABLE ogcode_daily_challenges DROP COLUMN IF EXISTS mode;
