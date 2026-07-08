-- Rollback for ODG Phase 4. Drops the decay-support index only.

DROP INDEX IF EXISTS odg.idx_odg_mastery_user_decayed;
