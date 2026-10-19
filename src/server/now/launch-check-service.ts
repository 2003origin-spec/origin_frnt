/**
 * Launch readiness check (decision B86): gathers facts about the live system
 * for launch-check-rules.ts. Read-only, and deliberately does NOT run the
 * runtime schema ensure, so a database where the migrations were never
 * applied is reported as such instead of being fixed quietly. Environment
 * variables are only ever reported as set / not set.
 */

import { isFeatureEnabled } from "@/lib/feature-flags";
import { isEmailConfigured } from "@/server/email";
import { isQStashConfigured } from "@/server/payments/qstash";
import { isRazorpayConfigured } from "@/server/payments/razorpay-client";
import { isPushConfigured } from "@/server/push/fcm";
import { getSetting } from "@/server/platform-settings";
import { getUserPostgresPool } from "@/server/user-postgres";

import { isKycEncryptionConfigured } from "./kyc-crypto";
import { launchChecklist, launchVerdict, type LaunchFacts } from "./launch-check-rules";
import { getLiveKitConfig, getRecordingBucket, hasRecordingCredentials } from "./livekit";
import { isPresenceStoreConfigured } from "./now-realtime";
import { NOW_ADDON_MIGRATIONS } from "./now-schema";
import { DEFAULT_NOW_SETTINGS, getNowSettings } from "./now-settings";
import { getPrivateFilesBucket } from "./private-files";
import { NOW_SUBJECTS } from "./solver-rules";
import { BOT_HELPER_ID } from "./solver-service";
import { getWebPushConfig } from "./web-push";

/**
 * The originNow kill switch: true when engaged, null when it cannot be read.
 * Loaded lazily because the incidents module pulls in next/navigation, which
 * only loads inside Next (not in scripts or tests).
 */
async function readKillSwitch(): Promise<boolean | null> {
  try {
    const { getFlagOverride } = await import("@/server/incidents");
    return (await getFlagOverride("originNow")) === false;
  } catch {
    return null;
  }
}

export async function getLaunchReadiness() {
  const pool = getUserPostgresPool();
  if (!pool) throw new Error("USER_DATABASE_URL is not configured");
  const one = async <T>(sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows[0] as T;

  const db = await one<{ tables: boolean; migrations: boolean; coin_pack: boolean; redemption: boolean }>(
    `SELECT
       (to_regclass('now.requests') IS NOT NULL AND to_regclass('now.ledger_entries') IS NOT NULL
         AND to_regclass('store.items') IS NOT NULL) AS tables,
       to_regclass('app.migrations') IS NOT NULL AS migrations,
       EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
                WHERE n.nspname = 'payments' AND t.typname = 'order_kind' AND e.enumlabel = 'coin_pack') AS coin_pack,
       COALESCE((SELECT position('coin_redemption' IN pg_get_constraintdef(c.oid)) > 0 FROM pg_constraint c
                  WHERE c.conrelid = to_regclass('entitlements.subject_grants') AND c.conname = 'subject_grants_source_check'), FALSE) AS redemption`,
  );
  const applied = db.migrations
    ? new Set(
        (await pool.query<{ id: string }>(`SELECT id FROM app.migrations WHERE id = ANY($1::text[])`, [NOW_ADDON_MIGRATIONS.map((m) => m.id)])).rows.map(
          (r) => r.id,
        ),
      )
    : new Set<string>();

  const facts: LaunchFacts = {
    tablesPresent: db.tables,
    coinPackOrderKind: db.coin_pack,
    coinRedemptionGrantSource: db.redemption,
    addonMigrations: NOW_ADDON_MIGRATIONS.map((m) => ({ id: m.id, applied: applied.has(m.id) })),
    env: {
      redis: isPresenceStoreConfigured(),
      livekit: getLiveKitConfig() !== null,
      recording: hasRecordingCredentials(),
      recordingBucket: getRecordingBucket().problem ?? "ok",
      privateFiles: getPrivateFilesBucket().problem ?? "ok",
      email: isEmailConfigured(),
      cronSecret: Boolean(process.env.CRON_SECRET?.trim()),
      qstash: isQStashConfigured(),
      razorpay: isRazorpayConfigured(),
      kycKey: isKycEncryptionConfigured(),
      webPush: getWebPushConfig() !== null,
      fcm: isPushConfigured(),
    },
    pricesSaved: false,
    packsOnSale: 0,
    welcomeCoinsSet: false,
    agreementIsDraft: true,
    botRow: false,
    solvers: Object.fromEntries(NOW_SUBJECTS.map((s) => [s, 0])),
    cohort: 0,
    storeItemsOnSale: 0,
    flagOn: isFeatureEnabled("originNow"),
    killSwitchOn: await readKillSwitch(),
  };

  // Setup facts need the tables; without them everything below stays "not done".
  if (db.tables) {
    const [settings, welcome, counts, solvers] = await Promise.all([
      getNowSettings(),
      getSetting("now_welcome_coins"),
      one<{ prices: number; packs: number; bot: boolean; cohort: number; items: number }>(
        `SELECT (SELECT count(*)::int FROM now.prices) AS prices,
                (SELECT count(*)::int FROM now.coin_packs WHERE active) AS packs,
                EXISTS (SELECT 1 FROM now.helpers WHERE id = $1) AS bot,
                (SELECT count(*)::int FROM now.pilot_cohort WHERE removed_at IS NULL) AS cohort,
                (SELECT count(*)::int FROM store.items WHERE active) AS items`,
        [BOT_HELPER_ID],
      ),
      pool.query<{ subject: string; n: number }>(
        `SELECT e.subject, count(DISTINCT h.id)::int AS n
           FROM now.helpers h JOIN now.helper_expertise e ON e.helper_id = h.id
          WHERE h.kind = 'human' AND h.verification_status = 'verified'
          GROUP BY e.subject`,
      ),
    ]);
    // An empty now.prices means the built-in placeholder table is in use.
    facts.pricesSaved = counts.prices > 0;
    facts.packsOnSale = counts.packs;
    facts.welcomeCoinsSet = welcome !== null;
    facts.agreementIsDraft = settings.agreementVersion === DEFAULT_NOW_SETTINGS.agreementVersion;
    facts.botRow = counts.bot;
    facts.cohort = counts.cohort;
    facts.storeItemsOnSale = counts.items;
    for (const row of solvers.rows) if (row.subject in facts.solvers) facts.solvers[row.subject] = row.n;
  }

  const items = launchChecklist(facts);
  return { checkedAt: new Date().toISOString(), ...launchVerdict(items), items };
}
