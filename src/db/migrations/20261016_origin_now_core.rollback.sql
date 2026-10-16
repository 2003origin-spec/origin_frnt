-- Rollback for 20261016_origin_now_core.sql (Origin NOW core schema).
-- Drops every Origin NOW table, including the Ori Coins ledger. Coin balances
-- are lost; export now.ledger_entries first if any real coins were issued.
DROP SCHEMA IF EXISTS store CASCADE;
DROP SCHEMA IF EXISTS now CASCADE;
DROP TABLE IF EXISTS app.guardian_consents CASCADE;
-- date_of_birth is left on origin_users: dropping a column that may already
-- hold user-entered data is a separate, deliberate decision. To drop it:
-- ALTER TABLE origin_users DROP COLUMN IF EXISTS date_of_birth;
DELETE FROM app.migrations WHERE id = '20261016_origin_now_core';
