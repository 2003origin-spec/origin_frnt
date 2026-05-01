/**
 * Postgres-backed implementations of user, auth session, and task operations.
 * All functions return null / throw when Postgres is not configured — callers
 * must check isUserPostgresConfigured() and fall back to the flat-file store.
 *
 * Schema: see src/db/schema.sql
 * Activate by setting USER_DATABASE_URL in your environment.
 */

import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Pool } from "pg";
import { withStoredUserDefaults, type StoredAuthSession, type StoredTask, type StoredUser, type StoredUserWithOptionalDefaults } from "@/server/store";
import { getUserPostgresPool } from "@/server/user-postgres";

declare global {
  var __originUserSchemaEnsured: boolean | undefined;
  var __originUserSchemaPromise: Promise<void> | undefined;
}

const ACCESS_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function createId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function pool(): Pool {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

export async function ensureUserSchema(): Promise<void> {
  if (globalThis.__originUserSchemaEnsured) return;
  if (!globalThis.__originUserSchemaPromise) {
    globalThis.__originUserSchemaPromise = (async () => {
      const client = await pool().connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS origin_users (
            id                  TEXT PRIMARY KEY,
            name                TEXT NOT NULL,
            email               TEXT NOT NULL,
            password_hash       TEXT NOT NULL,
            role                TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
            student_class       TEXT,
            field_of_interest   TEXT,
            referral_source     TEXT,
            avatar              TEXT,
            streak              INTEGER NOT NULL DEFAULT 0,
            total_study_time    INTEGER NOT NULL DEFAULT 0,
            joined_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            is_premium          BOOLEAN NOT NULL DEFAULT FALSE,
            premium_expiry      TIMESTAMPTZ,
            is_onboarded        BOOLEAN NOT NULL DEFAULT FALSE,
            selected_course     TEXT,
            is_dropper          BOOLEAN NOT NULL DEFAULT FALSE,
            years_of_experience TEXT,
            subjects            TEXT[] NOT NULL DEFAULT '{}',
            student_capacity    TEXT,
            location            TEXT,
            voice_minutes_used_today FLOAT NOT NULL DEFAULT 0,
            tokens_used_today   INTEGER NOT NULL DEFAULT 0,
            usage_reset_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (email, role)
          );

          -- Migrations
          ALTER TABLE origin_users ADD COLUMN IF NOT EXISTS location TEXT;
          ALTER TABLE origin_users ADD COLUMN IF NOT EXISTS voice_minutes_used_today FLOAT NOT NULL DEFAULT 0;
          ALTER TABLE origin_users ADD COLUMN IF NOT EXISTS tokens_used_today INTEGER NOT NULL DEFAULT 0;
          ALTER TABLE origin_users ADD COLUMN IF NOT EXISTS usage_reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

          CREATE TABLE IF NOT EXISTS origin_auth_sessions (
            access_token              TEXT PRIMARY KEY,
            refresh_token             TEXT NOT NULL UNIQUE,
            user_id                   TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
            created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            access_token_expires_at   TIMESTAMPTZ NOT NULL,
            refresh_token_expires_at  TIMESTAMPTZ NOT NULL
          );

          CREATE INDEX IF NOT EXISTS idx_auth_sessions_refresh ON origin_auth_sessions (refresh_token);
          CREATE INDEX IF NOT EXISTS idx_auth_sessions_user    ON origin_auth_sessions (user_id);

          CREATE TABLE IF NOT EXISTS origin_tasks (
            id         TEXT PRIMARY KEY,
            user_id    TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
            text       TEXT NOT NULL,
            completed  BOOLEAN NOT NULL DEFAULT FALSE,
            due        TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            category   TEXT,
            priority   TEXT CHECK (priority IN ('low', 'medium', 'high'))
          );

          CREATE INDEX IF NOT EXISTS idx_tasks_user ON origin_tasks (user_id);
        `);
        globalThis.__originUserSchemaEnsured = true;
      } finally {
        client.release();
      }
    })().catch((error) => {
      globalThis.__originUserSchemaPromise = undefined;
      throw error;
    });
  }
  await globalThis.__originUserSchemaPromise;
}

// ─── Row → domain type mappers ────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToUser(row: any): StoredUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password_hash,
    role: row.role,
    studentClass: row.student_class ?? null,
    fieldOfInterest: row.field_of_interest ?? null,
    referralSource: row.referral_source ?? null,
    avatar: row.avatar ?? null,
    streak: row.streak ?? 0,
    totalStudyTime: row.total_study_time ?? 0,
    joinedAt: row.joined_at instanceof Date ? row.joined_at.toISOString() : String(row.joined_at),
    isPremium: Boolean(row.is_premium),
    premiumExpiry: row.premium_expiry ? (row.premium_expiry instanceof Date ? row.premium_expiry.toISOString() : String(row.premium_expiry)) : null,
    isOnboarded: Boolean(row.is_onboarded),
    selectedCourse: row.selected_course ?? null,
    isDropper: Boolean(row.is_dropper),
    yearsOfExperience: row.years_of_experience ?? null,
    subjects: Array.isArray(row.subjects) ? row.subjects : [],
    studentCapacity: row.student_capacity ?? null,
    location: row.location ?? null,
    voiceMinutesUsedToday: Number(row.voice_minutes_used_today ?? 0),
    tokensUsedToday: Number(row.tokens_used_today ?? 0),
    usageResetAt: row.usage_reset_at instanceof Date ? row.usage_reset_at.toISOString() : String(row.usage_reset_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSession(row: any): StoredAuthSession {
  return {
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    userId: row.user_id,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    accessTokenExpiresAt: row.access_token_expires_at instanceof Date ? row.access_token_expires_at.toISOString() : String(row.access_token_expires_at),
    refreshTokenExpiresAt: row.refresh_token_expires_at instanceof Date ? row.refresh_token_expires_at.toISOString() : String(row.refresh_token_expires_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToTask(row: any): StoredTask {
  return {
    id: row.id,
    userId: row.user_id,
    text: row.text,
    completed: Boolean(row.completed),
    due: row.due instanceof Date ? row.due.toISOString() : String(row.due),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    category: row.category ?? undefined,
    priority: row.priority ?? undefined,
  };
}

// ─── User operations ──────────────────────────────────────────────────────────

export async function dbFindUserByEmail(email: string, role: string): Promise<StoredUser | null> {
  await ensureUserSchema();
  const result = await pool().query(
    "SELECT * FROM origin_users WHERE LOWER(email) = LOWER($1) AND role = $2 LIMIT 1",
    [email, role],
  );
  return result.rows[0] ? rowToUser(result.rows[0]) : null;
}

export async function dbFindUserById(id: string): Promise<StoredUser | null> {
  await ensureUserSchema();
  const result = await pool().query("SELECT * FROM origin_users WHERE id = $1 LIMIT 1", [id]);
  return result.rows[0] ? rowToUser(result.rows[0]) : null;
}

type DbCreateUserInput = Omit<StoredUserWithOptionalDefaults, "id"> & { id?: string };

export async function dbCreateUser(data: DbCreateUserInput): Promise<StoredUser> {
  await ensureUserSchema();
  const id = data.id ?? createId("user");
  const user = withStoredUserDefaults({ ...data, id });
  await pool().query(
    `INSERT INTO origin_users
       (id, name, email, password_hash, role, student_class, field_of_interest,
        referral_source, avatar, streak, total_study_time, joined_at, is_premium,
        premium_expiry, is_onboarded, selected_course, is_dropper,
        years_of_experience, subjects, student_capacity, location,
        voice_minutes_used_today, tokens_used_today, usage_reset_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)`,
    [
      user.id, user.name, user.email, user.password, user.role,
      user.studentClass, user.fieldOfInterest, user.referralSource, user.avatar,
      user.streak, user.totalStudyTime, user.joinedAt, user.isPremium,
      user.premiumExpiry, user.isOnboarded, user.selectedCourse, user.isDropper,
      user.yearsOfExperience, user.subjects, user.studentCapacity, user.location,
      user.voiceMinutesUsedToday, user.tokensUsedToday, user.usageResetAt,
    ],
  );
  return user;
}

export async function dbUpdateUser(id: string, patch: Partial<StoredUser>): Promise<void> {
  await ensureUserSchema();
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  const mapping: Record<string, string> = {
    name: "name", email: "email", password: "password_hash", role: "role",
    studentClass: "student_class", fieldOfInterest: "field_of_interest",
    referralSource: "referral_source", avatar: "avatar", streak: "streak",
    totalStudyTime: "total_study_time", isPremium: "is_premium",
    premiumExpiry: "premium_expiry", isOnboarded: "is_onboarded",
    selectedCourse: "selected_course", isDropper: "is_dropper",
    yearsOfExperience: "years_of_experience", subjects: "subjects",
    studentCapacity: "student_capacity", location: "location",
    voiceMinutesUsedToday: "voice_minutes_used_today", tokensUsedToday: "tokens_used_today",
    usageResetAt: "usage_reset_at",
  };

  for (const [key, col] of Object.entries(mapping)) {
    if (key in patch) {
      fields.push(`${col} = $${i++}`);
      values.push((patch as Record<string, unknown>)[key]);
    }
  }

  if (fields.length === 0) return;
  values.push(id);
  await pool().query(`UPDATE origin_users SET ${fields.join(", ")} WHERE id = $${i}`, values);
}

// ─── Auth session operations ──────────────────────────────────────────────────

export async function dbFindUserByAccessToken(accessToken: string): Promise<StoredUser | null> {
  await ensureUserSchema();
  const result = await pool().query(
    `SELECT u.* FROM origin_users u
     JOIN origin_auth_sessions s ON s.user_id = u.id
     WHERE s.access_token = $1 AND s.access_token_expires_at > NOW()
     LIMIT 1`,
    [accessToken],
  );
  return result.rows[0] ? rowToUser(result.rows[0]) : null;
}

export async function dbGetSessionByRefreshToken(refreshToken: string): Promise<StoredAuthSession | null> {
  await ensureUserSchema();
  const result = await pool().query(
    "SELECT * FROM origin_auth_sessions WHERE refresh_token = $1 AND refresh_token_expires_at > NOW() LIMIT 1",
    [refreshToken],
  );
  return result.rows[0] ? rowToSession(result.rows[0]) : null;
}

export async function dbCreateAuthSession(userId: string): Promise<StoredAuthSession> {
  await ensureUserSchema();
  const now = Date.now();
  const session: StoredAuthSession = {
    accessToken: createId("access"),
    refreshToken: createId("refresh"),
    userId,
    createdAt: new Date(now).toISOString(),
    accessTokenExpiresAt: new Date(now + ACCESS_TOKEN_TTL_MS).toISOString(),
    refreshTokenExpiresAt: new Date(now + REFRESH_TOKEN_TTL_MS).toISOString(),
  };

  // One active session per user — delete old ones first
  await pool().query("DELETE FROM origin_auth_sessions WHERE user_id = $1", [userId]);
  await pool().query(
    `INSERT INTO origin_auth_sessions
       (access_token, refresh_token, user_id, created_at, access_token_expires_at, refresh_token_expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [session.accessToken, session.refreshToken, session.userId, session.createdAt, session.accessTokenExpiresAt, session.refreshTokenExpiresAt],
  );
  return session;
}

export async function dbRotateAccessToken(refreshToken: string): Promise<StoredAuthSession | null> {
  await ensureUserSchema();
  const now = Date.now();
  const newAccessToken = createId("access");
  const newExpiry = new Date(now + ACCESS_TOKEN_TTL_MS).toISOString();

  const result = await pool().query(
    `UPDATE origin_auth_sessions
     SET access_token = $1, access_token_expires_at = $2
     WHERE refresh_token = $3 AND refresh_token_expires_at > NOW()
     RETURNING *`,
    [newAccessToken, newExpiry, refreshToken],
  );
  return result.rows[0] ? rowToSession(result.rows[0]) : null;
}

export async function dbClearUserSessions(userId: string): Promise<void> {
  await ensureUserSchema();
  await pool().query("DELETE FROM origin_auth_sessions WHERE user_id = $1", [userId]);
}

// ─── Task operations ──────────────────────────────────────────────────────────

export async function dbGetTasks(userId: string): Promise<StoredTask[]> {
  await ensureUserSchema();
  const result = await pool().query(
    "SELECT * FROM origin_tasks WHERE user_id = $1 ORDER BY created_at DESC",
    [userId],
  );
  return result.rows.map(rowToTask);
}

export async function dbCreateTask(userId: string, text: string, due: string, category?: string, priority?: string): Promise<StoredTask> {
  await ensureUserSchema();
  const id = createId("task");
  const createdAt = new Date().toISOString();
  await pool().query(
    "INSERT INTO origin_tasks (id, user_id, text, completed, due, created_at, category, priority) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
    [id, userId, text, false, due, createdAt, category ?? null, priority ?? null],
  );
  return { id, userId, text, completed: false, due, createdAt, category, priority: priority as StoredTask["priority"] };
}

export async function dbUpdateTask(id: string, userId: string, patch: { completed?: boolean; text?: string; due?: string }): Promise<StoredTask | null> {
  await ensureUserSchema();
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if ("completed" in patch) { fields.push(`completed = $${i++}`); values.push(patch.completed); }
  if ("text" in patch)      { fields.push(`text = $${i++}`);      values.push(patch.text); }
  if ("due" in patch)       { fields.push(`due = $${i++}`);       values.push(patch.due); }

  if (fields.length === 0) return null;
  values.push(id, userId);
  const result = await pool().query(
    `UPDATE origin_tasks SET ${fields.join(", ")} WHERE id = $${i++} AND user_id = $${i} RETURNING *`,
    values,
  );
  return result.rows[0] ? rowToTask(result.rows[0]) : null;
}

export async function dbDeleteTask(id: string, userId: string): Promise<boolean> {
  await ensureUserSchema();
  const result = await pool().query(
    "DELETE FROM origin_tasks WHERE id = $1 AND user_id = $2",
    [id, userId],
  );
  return (result.rowCount ?? 0) > 0;
}

// ─── Login / register helpers (DB-backed) ─────────────────────────────────────

export async function dbLoginUser(email: string, password: string, role: string): Promise<{ user: StoredUser; session: StoredAuthSession } | null> {
  const user = await dbFindUserByEmail(email, role);
  if (!user) return null;
  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return null;
  const session = await dbCreateAuthSession(user.id);
  return { user, session };
}

export async function dbRegisterUser(data: {
  name: string; email: string; password: string; role: string;
  studentClass?: string; fieldOfInterest?: string; referralSource?: string;
}): Promise<{ user: StoredUser; session: StoredAuthSession }> {
  const existing = await dbFindUserByEmail(data.email, data.role);
  if (existing) throw new Error("An account with this email already exists for this role.");

  const id = createId("user");
  const hashed = bcrypt.hashSync(data.password, 10);
  const user = await dbCreateUser({
    id, name: data.name, email: data.email, password: hashed,
    role: data.role as StoredUser["role"],
    studentClass: data.studentClass ?? null, fieldOfInterest: data.fieldOfInterest ?? null,
    referralSource: data.referralSource ?? null, avatar: null, streak: 0, totalStudyTime: 0,
    joinedAt: new Date().toISOString(), isPremium: false, premiumExpiry: null,
    isOnboarded: false, selectedCourse: null, isDropper: false,
    yearsOfExperience: null, subjects: [], studentCapacity: null,
    voiceMinutesUsedToday: 0, tokensUsedToday: 0, usageResetAt: new Date().toISOString(),
  });
  const session = await dbCreateAuthSession(user.id);
  return { user, session };
}

export async function dbUpdateUsageMetrics(userId: string, metrics: { voiceMinutes?: number; tokens?: number }): Promise<{ voiceMinutesUsedToday: number; tokensUsedToday: number }> {
  await ensureUserSchema();
  const { voiceMinutes = 0, tokens = 0 } = metrics;

  // Use a single query with daily reset logic:
  // If usage_reset_at is not today (UTC), reset counters to 0 and update reset time to now.
  // Then add the new usage values.
  const result = await pool().query(
    `UPDATE origin_users
     SET
       voice_minutes_used_today = CASE
         WHEN usage_reset_at < CURRENT_DATE THEN $1::FLOAT
         ELSE voice_minutes_used_today + $1::FLOAT
       END,
       tokens_used_today = CASE
         WHEN usage_reset_at < CURRENT_DATE THEN $2::INTEGER
         ELSE tokens_used_today + $2::INTEGER
       END,
       usage_reset_at = CASE
         WHEN usage_reset_at < CURRENT_DATE THEN NOW()
         ELSE usage_reset_at
       END
     WHERE id = $3
     RETURNING voice_minutes_used_today, tokens_used_today`,
    [voiceMinutes, tokens, userId],
  );

  const row = result.rows[0];
  return {
    voiceMinutesUsedToday: row?.voice_minutes_used_today ?? 0,
    tokensUsedToday: row?.tokens_used_today ?? 0,
  };
}

export async function dbGetUserCount(): Promise<number> {
  await ensureUserSchema();
  const result = await pool().query("SELECT COUNT(*) FROM origin_users");
  return parseInt(result.rows[0].count, 10);
}
