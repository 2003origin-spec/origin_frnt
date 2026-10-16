/**
 * Idempotent runtime ensure for Origin NOW: the `now` schema (helpers,
 * requests, offers, sessions, ratings, reports, the Ori Coins ledger), the
 * `store` schema (Origin Store items + orders), `app.guardian_consents`, and
 * `origin_users.date_of_birth`.
 *
 * Canonical SQL: src/db/migrations/20261016_origin_now_core.sql — kept
 * identical to NOW_SCHEMA_DDL below by tests/now/now-schema.test.ts. The
 * migration is deliberately NOT in scripts/run-migrations.mjs yet (plan
 * decision B2): nothing reaches the production database until the pilot gate.
 *
 * Plan: V1/ORIGIN_NOW_PLAN.md
 */

import type { PoolClient } from "pg";

import { ensureUserSchema } from "@/server/db-users";
import { SCHEMA_DDL_LOCK_ID } from "@/server/schema-lock";
import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";

declare global {
  var __originNowSchemaEnsured: boolean | undefined;
  var __originNowSchemaPromise: Promise<void> | undefined;
}

export const NOW_MIGRATION_ID = "20261016_origin_now_core";

/**
 * Each entry is one statement group sent as a single query. Order matters only
 * for foreign keys. Every statement is `IF NOT EXISTS` or a guarded DO block,
 * so re-running is a no-op that takes no AccessExclusiveLock on a correct DB.
 */
export const NOW_SCHEMA_DDL: readonly string[] = [
  `CREATE SCHEMA IF NOT EXISTS now;
CREATE SCHEMA IF NOT EXISTS store;`,

  // Date of birth: the children's policy already promises it at signup.
  `DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'origin_users' AND column_name = 'date_of_birth'
  ) THEN
    ALTER TABLE origin_users ADD COLUMN date_of_birth DATE;
  END IF;
END $$;`,

  `CREATE TABLE IF NOT EXISTS app.guardian_consents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('student', 'solver')),
  guardian_name TEXT NOT NULL,
  guardian_email TEXT,
  guardian_phone TEXT,
  relationship TEXT NOT NULL,
  verified_via TEXT NOT NULL CHECK (verified_via IN ('email_otp', 'phone_otp', 'digilocker', 'admin')),
  policy_version TEXT NOT NULL,
  consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  withdrawn_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_guardian_consents_user ON app.guardian_consents(user_id, purpose);`,

  // Pending guardian consent: only the token hash is stored; the raw token
  // travels once, in the guardian's email link.
  `CREATE TABLE IF NOT EXISTS now.consent_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('student', 'solver')),
  guardian_name TEXT NOT NULL,
  guardian_email TEXT NOT NULL,
  guardian_phone TEXT,
  relationship TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  policy_version TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ,
  consent_id TEXT REFERENCES app.guardian_consents(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_consent_requests_user ON now.consent_requests(user_id, created_at DESC);`,

  `CREATE TABLE IF NOT EXISTS now.pilot_cohort (
  user_id TEXT PRIMARY KEY REFERENCES origin_users(id) ON DELETE CASCADE,
  invited_by TEXT REFERENCES origin_users(id),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ
);`,

  `CREATE TABLE IF NOT EXISTS now.prices (
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard', 'insane')),
  solver_kind TEXT NOT NULL CHECK (solver_kind IN ('human', 'bot')),
  price_coins INTEGER NOT NULL CHECK (price_coins > 0),
  minutes INTEGER NOT NULL CHECK (minutes BETWEEN 1 AND 60),
  extension_minutes INTEGER NOT NULL CHECK (extension_minutes BETWEEN 1 AND 30),
  extension_coins INTEGER NOT NULL CHECK (extension_coins >= 0),
  max_extensions INTEGER NOT NULL CHECK (max_extensions BETWEEN 0 AND 10),
  updated_by TEXT REFERENCES origin_users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (difficulty, solver_kind)
);`,

  `CREATE TABLE IF NOT EXISTS now.helper_applications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'college_student', 'school_student', 'other')),
  display_name TEXT NOT NULL,
  subjects TEXT[] NOT NULL DEFAULT '{}',
  chapters JSONB NOT NULL DEFAULT '{}'::jsonb,
  languages TEXT[] NOT NULL DEFAULT '{}',
  aadhaar_ref TEXT,
  documents JSONB NOT NULL DEFAULT '{}'::jsonb,
  pan_encrypted TEXT,
  pan_last4 TEXT,
  guardian_consent_id TEXT REFERENCES app.guardian_consents(id),
  quiz_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  demo_recording_key TEXT,
  demo_passed BOOLEAN,
  agreement_version TEXT,
  agreement_accepted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  reviewed_by TEXT REFERENCES origin_users(id),
  reviewed_at TIMESTAMPTZ,
  reject_reason TEXT,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_helper_applications_open
  ON now.helper_applications(user_id) WHERE status IN ('draft', 'submitted');
CREATE INDEX IF NOT EXISTS idx_helper_applications_status ON now.helper_applications(status, submitted_at);`,

  `CREATE TABLE IF NOT EXISTS now.quiz_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  question_ids TEXT[] NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  score INTEGER,
  total INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON now.quiz_attempts(user_id, subject, started_at DESC);`,

  `CREATE TABLE IF NOT EXISTS now.helpers (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE REFERENCES origin_users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('human', 'bot')),
  role TEXT CHECK (role IN ('teacher', 'college_student', 'school_student', 'other')),
  display_name TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'verified'
    CHECK (verification_status IN ('verified', 'restricted', 'rejected')),
  is_minor BOOLEAN NOT NULL DEFAULT FALSE,
  languages TEXT[] NOT NULL DEFAULT '{}',
  agreement_version TEXT,
  agreement_accepted_at TIMESTAMPTZ,
  linked_user_ids TEXT[] NOT NULL DEFAULT '{}',
  application_id TEXT REFERENCES now.helper_applications(id),
  restricted_reason TEXT,
  verified_at TIMESTAMPTZ,
  reverify_by TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((kind = 'bot') = (user_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_helpers_single_bot ON now.helpers(kind) WHERE kind = 'bot';`,

  `CREATE TABLE IF NOT EXISTS now.helper_expertise (
  helper_id TEXT NOT NULL REFERENCES now.helpers(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  chapter TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL DEFAULT 'verified' CHECK (level IN ('trainee', 'verified', 'expert')),
  PRIMARY KEY (helper_id, subject, chapter)
);
CREATE INDEX IF NOT EXISTS idx_helper_expertise_subject ON now.helper_expertise(subject, chapter);`,

  `CREATE TABLE IF NOT EXISTS now.favourites (
  student_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  helper_id TEXT NOT NULL REFERENCES now.helpers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (student_id, helper_id)
);`,

  `CREATE TABLE IF NOT EXISTS now.blocks (
  blocker_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);`,

  `CREATE TABLE IF NOT EXISTS now.requests (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  chapter TEXT,
  concept TEXT,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard', 'insane')),
  language TEXT,
  price_coins INTEGER NOT NULL CHECK (price_coins > 0),
  held_coins INTEGER NOT NULL DEFAULT 0 CHECK (held_coins >= 0),
  solver_kind TEXT CHECK (solver_kind IN ('human', 'bot')),
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN (
    'requested', 'offered', 'accepted', 'live', 'ended', 'rated',
    'cancelled', 'no_helper', 'no_show', 'unrated'
  )),
  current_offer_id TEXT,
  helper_id TEXT REFERENCES now.helpers(id),
  failed_offers INTEGER NOT NULL DEFAULT 0,
  excluded_helper_ids TEXT[] NOT NULL DEFAULT '{}',
  callback_offered BOOLEAN NOT NULL DEFAULT FALSE,
  origin_ai_session_id TEXT,
  ai_explained BOOLEAN NOT NULL DEFAULT FALSE,
  context_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  closed_reason TEXT CHECK (closed_reason IN ('cancelled', 'no_helper', 'no_show')),
  closed_detail TEXT CHECK (closed_detail IN ('all_busy', 'none_online')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  connected_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_requests_one_open_per_student
  ON now.requests(student_id) WHERE status IN ('requested', 'offered', 'accepted', 'live');
CREATE INDEX IF NOT EXISTS idx_requests_status_created ON now.requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_requests_student_created ON now.requests(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_helper_created ON now.requests(helper_id, created_at DESC);`,

  `CREATE TABLE IF NOT EXISTS now.offers (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES now.requests(id) ON DELETE CASCADE,
  helper_id TEXT NOT NULL REFERENCES now.helpers(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  offered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  response TEXT CHECK (response IN ('accepted', 'declined', 'expired')),
  decline_reason TEXT CHECK (decline_reason IN ('not_my_topic', 'busy', 'too_hard', 'other')),
  responded_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_offers_one_open_per_request
  ON now.offers(request_id) WHERE response IS NULL;
CREATE INDEX IF NOT EXISTS idx_offers_helper_open ON now.offers(helper_id) WHERE response IS NULL;
CREATE INDEX IF NOT EXISTS idx_offers_expiry_open ON now.offers(expires_at) WHERE response IS NULL;
CREATE INDEX IF NOT EXISTS idx_offers_helper_time ON now.offers(helper_id, offered_at DESC);`,

  `CREATE TABLE IF NOT EXISTS now.sessions (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES now.requests(id) ON DELETE CASCADE,
  helper_id TEXT NOT NULL REFERENCES now.helpers(id),
  student_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  solver_kind TEXT NOT NULL CHECK (solver_kind IN ('human', 'bot')),
  livekit_room TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  student_joined_at TIMESTAMPTZ,
  helper_joined_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  ended_by TEXT CHECK (ended_by IN ('student', 'helper', 'timer', 'admin', 'no_show')),
  extensions_used INTEGER NOT NULL DEFAULT 0,
  extension_requested_at TIMESTAMPTZ,
  outcome TEXT CHECK (outcome IN ('resolved', 'partial', 'unresolved')),
  root_cause TEXT CHECK (root_cause IN (
    'conceptual_gap', 'calculation_error', 'misread', 'careless_error', 'time_pressure', 'other'
  )),
  payable BOOLEAN,
  settled_at TIMESTAMPTZ,
  recording_key TEXT,
  recording_egress_id TEXT,
  recording_started_at TIMESTAMPTZ,
  recording_deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sessions_request ON now.sessions(request_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sessions_one_live_per_human_helper
  ON now.sessions(helper_id) WHERE ended_at IS NULL AND solver_kind = 'human';
CREATE INDEX IF NOT EXISTS idx_sessions_ends_open ON now.sessions(ends_at) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_helper_time ON now.sessions(helper_id, accepted_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_student_time ON now.sessions(student_id, accepted_at DESC);`,

  `CREATE TABLE IF NOT EXISTS now.events (
  id BIGSERIAL PRIMARY KEY,
  request_id TEXT,
  session_id TEXT,
  type TEXT NOT NULL,
  actor TEXT,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_events_request ON now.events(request_id, at);
CREATE INDEX IF NOT EXISTS idx_events_type_time ON now.events(type, at);`,

  `CREATE TABLE IF NOT EXISTS now.ratings (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES now.sessions(id) ON DELETE CASCADE,
  rater_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  helper_id TEXT NOT NULL REFERENCES now.helpers(id) ON DELETE CASCADE,
  stars SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  tags TEXT[] NOT NULL DEFAULT '{}',
  comment TEXT,
  counted BOOLEAN NOT NULL DEFAULT TRUE,
  held_until_case_closes BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, rater_id)
);
CREATE INDEX IF NOT EXISTS idx_ratings_helper_time ON now.ratings(helper_id, created_at DESC);`,

  `CREATE TABLE IF NOT EXISTS now.reports (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES now.sessions(id) ON DELETE SET NULL,
  reporter_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  reported_user_id TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN ('child_safety', 'abuse', 'contact_sharing', 'wrong_content', 'no_show', 'other')),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'upheld', 'dismissed')),
  reviewed_by TEXT REFERENCES origin_users(id),
  reviewed_at TIMESTAMPTZ,
  first_response_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON now.reports(status, created_at);
CREATE INDEX IF NOT EXISTS idx_reports_reported ON now.reports(reported_user_id, created_at DESC);`,

  // Ori Coins ledger. Accounts are 'user:<id>' or 'platform:<name>'.
  `CREATE TABLE IF NOT EXISTS now.accounts (
  id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('user', 'platform')),
  owner_id TEXT NOT NULL,
  frozen BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`,

  `CREATE TABLE IF NOT EXISTS now.ledger_transfers (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN (
    'welcome_grant', 'pack_purchase', 'promo_bonus', 'session_hold', 'session_capture',
    'session_release', 'extension', 'tip', 'commission', 'transfer', 'store_spend',
    'expiry', 'admin_adjustment', 'pack_refund'
  )),
  idempotency_key TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  request_id TEXT,
  order_ref TEXT,
  note TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ledger_transfers_request ON now.ledger_transfers(request_id);`,

  `CREATE TABLE IF NOT EXISTS now.ledger_entries (
  id BIGSERIAL PRIMARY KEY,
  transfer_id TEXT NOT NULL REFERENCES now.ledger_transfers(id),
  account_id TEXT NOT NULL REFERENCES now.accounts(id),
  direction TEXT NOT NULL CHECK (direction IN ('debit', 'credit')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  kind TEXT NOT NULL,
  available_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_account ON now.ledger_entries(account_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_transfer ON now.ledger_entries(transfer_id);`,

  `CREATE TABLE IF NOT EXISTS now.welcome_grants (
  user_id TEXT PRIMARY KEY REFERENCES origin_users(id) ON DELETE CASCADE,
  coins INTEGER NOT NULL CHECK (coins >= 0),
  transfer_id TEXT REFERENCES now.ledger_transfers(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`,

  `CREATE TABLE IF NOT EXISTS now.coin_packs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  coins INTEGER NOT NULL CHECK (coins > 0),
  price_paise INTEGER NOT NULL CHECK (price_paise > 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`,

  `CREATE TABLE IF NOT EXISTS now.promotions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('percent_on_pack', 'flat_grant')),
  value INTEGER NOT NULL CHECK (value > 0),
  audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'cohort', 'pack_buyers')),
  pack_id TEXT REFERENCES now.coin_packs(id),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  bonus_expires_after_days INTEGER CHECK (bonus_expires_after_days IS NULL OR bonus_expires_after_days > 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT REFERENCES origin_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);`,

  `CREATE TABLE IF NOT EXISTS now.daily_stats (
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'solver')),
  day DATE NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  chapter TEXT NOT NULL DEFAULT '',
  difficulty TEXT NOT NULL DEFAULT '',
  doubts INTEGER NOT NULL DEFAULT 0,
  resolved INTEGER NOT NULL DEFAULT 0,
  partial INTEGER NOT NULL DEFAULT 0,
  unresolved INTEGER NOT NULL DEFAULT 0,
  minutes INTEGER NOT NULL DEFAULT 0,
  rating_sum INTEGER NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  coins_in INTEGER NOT NULL DEFAULT 0,
  coins_out INTEGER NOT NULL DEFAULT 0,
  offers INTEGER NOT NULL DEFAULT 0,
  accepts INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, role, day, subject, chapter, difficulty)
);`,

  `CREATE TABLE IF NOT EXISTS store.items (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('merch', 'printed', 'digital', 'premium')),
  title TEXT NOT NULL,
  description TEXT,
  image_key TEXT,
  price_coins INTEGER NOT NULL DEFAULT 0 CHECK (price_coins >= 0),
  price_paise INTEGER NOT NULL DEFAULT 0 CHECK (price_paise >= 0),
  stock INTEGER CHECK (stock IS NULL OR stock >= 0),
  premium_subject TEXT CHECK (premium_subject IS NULL OR premium_subject IN ('physics', 'chemistry', 'mathematics', 'biology')),
  premium_days INTEGER CHECK (premium_days IS NULL OR premium_days > 0),
  file_key TEXT,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (price_coins > 0 OR price_paise > 0),
  CHECK (kind <> 'premium' OR (premium_subject IS NOT NULL AND premium_days IS NOT NULL))
);`,

  `CREATE TABLE IF NOT EXISTS store.orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES store.items(id),
  coins_spent INTEGER NOT NULL DEFAULT 0 CHECK (coins_spent >= 0),
  paise_paid INTEGER NOT NULL DEFAULT 0 CHECK (paise_paid >= 0),
  razorpay_order_id TEXT,
  status TEXT NOT NULL DEFAULT 'placed' CHECK (status IN ('placed', 'paid', 'fulfilled', 'cancelled')),
  fulfilled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_store_orders_user ON store.orders(user_id, created_at DESC);`,
];

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

async function recordMigration(client: PoolClient): Promise<void> {
  await client.query(
    "INSERT INTO app.migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
    [NOW_MIGRATION_ID, "origin now core (now.*, store.*, guardian consents, date_of_birth)"],
  );
}

export async function ensureNowSchema(): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  if (globalThis.__originNowSchemaEnsured) return;
  if (!globalThis.__originNowSchemaPromise) {
    globalThis.__originNowSchemaPromise = (async () => {
      // origin_users must exist before any FK below validates.
      await ensureUserSchema();
      const client = await pool().connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock($1)", [SCHEMA_DDL_LOCK_ID]);
        await client.query(`
          CREATE SCHEMA IF NOT EXISTS app;
          CREATE TABLE IF NOT EXISTS app.migrations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);
        for (const statement of NOW_SCHEMA_DDL) {
          await client.query(statement);
        }
        await recordMigration(client);
        await client.query("COMMIT");
        globalThis.__originNowSchemaEnsured = true;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    })().finally(() => {
      if (!globalThis.__originNowSchemaEnsured) globalThis.__originNowSchemaPromise = undefined;
    });
  }
  await globalThis.__originNowSchemaPromise;
}
