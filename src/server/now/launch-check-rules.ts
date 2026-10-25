/**
 * Launch readiness check (decision B86) — pure rules: plain facts about the
 * live system in, a checklist out. launch-check-service.ts gathers the facts
 * (read-only; environment variables only as set / not set).
 */

export type CheckStatus = "ok" | "warn" | "missing" | "info";

export type CheckItem = {
  key: string;
  group: "Database" | "Services" | "Setup" | "Switches";
  label: string;
  status: CheckStatus;
  /** What was found, in plain words. */
  detail: string;
  /** What to do when it is not ok (runbook section in brackets). */
  fix?: string;
};

export type LaunchFacts = {
  tablesPresent: boolean;
  coinPackOrderKind: boolean;
  /** now.ledger_transfers allows store_refund (migration 13, B91/B92). */
  storeRefundKind: boolean;
  /** payments.order_kind has store_item (migration 10, B92). */
  storeItemOrderKind: boolean;
  /** The extra parts switched on in Settings (B89–B95), by key. */
  featuresOn: string[];
  coinRedemptionGrantSource: boolean;
  addonMigrations: { id: string; applied: boolean }[];
  env: {
    redis: boolean;
    livekit: boolean;
    /** The dedicated recording key and secret (and an R2 endpoint). */
    recording: boolean;
    /** "public" = it names the public image bucket, which the app refuses (B87). */
    recordingBucket: "ok" | "not_set" | "public";
    /** R2_PRIVATE_BUCKET for KYC documents, papers and ask-later photos (B96). */
    privateFiles: "ok" | "not_set" | "public";
    email: boolean;
    cronSecret: boolean;
    qstash: boolean;
    razorpay: boolean;
    kycKey: boolean;
    webPush: boolean;
    /** FCM service account for the Android app's offer alerts (B88). */
    fcm: boolean;
  };
  pricesSaved: boolean;
  packsOnSale: number;
  welcomeCoinsSet: boolean;
  agreementIsDraft: boolean;
  botRow: boolean;
  /** Verified human solvers per subject. */
  solvers: Record<string, number>;
  cohort: number;
  storeItemsOnSale: number;
  flagOn: boolean;
  /** null when the kill-switch state could not be read. */
  killSwitchOn: boolean | null;
};

const FEATURE_NAMES: Record<string, string> = {
  board: "shared board",
  askLater: "ask later",
  groups: "group sessions",
  merch: "merch",
  rupeePrices: "rupee prices",
};

/** Pilot subjects: the evening checklist wants at least this many solvers each. */
export const PILOT_SUBJECTS = ["physics", "chemistry"] as const;
export const MIN_SOLVERS_PER_PILOT_SUBJECT = 2;

const yes = (ok: boolean, okText: string, badText: string) => (ok ? okText : badText);

export function launchChecklist(f: LaunchFacts): CheckItem[] {
  const items: CheckItem[] = [];
  const add = (item: CheckItem) => items.push(item);

  // Database.
  add({
    key: "db_tables",
    group: "Database",
    label: "Origin NOW tables",
    status: f.tablesPresent ? "ok" : "missing",
    detail: yes(f.tablesPresent, "Present.", "Not found."),
    fix: "Run migration 1, 20261016_origin_now_core.sql (runbook 1.3).",
  });
  add({
    key: "db_coin_pack",
    group: "Database",
    label: "Coin-pack payment type",
    status: f.coinPackOrderKind ? "ok" : "missing",
    detail: yes(f.coinPackOrderKind, "payments.order_kind has coin_pack.", "payments.order_kind has no coin_pack, so coin-pack checkout fails."),
    fix: "Run migration 2, 20261016_origin_now_coin_pack_order_kind.sql, on its own (runbook 1.3). Nothing in the app adds it by itself.",
  });
  add({
    key: "db_coin_redemption",
    group: "Database",
    label: "Premium bought with coins",
    status: f.coinRedemptionGrantSource ? "ok" : "warn",
    detail: yes(
      f.coinRedemptionGrantSource,
      "entitlements.subject_grants accepts coin_redemption.",
      "Not yet allowed; the first store purchase adds it, but run the migration to be sure.",
    ),
    fix: "Run migration 3, 20261017_origin_now_coin_redemption_grant.sql (runbook 1.3).",
  });
  for (const m of f.addonMigrations) {
    add({
      key: `db_${m.id}`,
      group: "Database",
      label: `Migration ${m.id}`,
      status: m.applied ? "ok" : "warn",
      detail: yes(m.applied, "Recorded as applied.", "Not recorded; the app creates it on first use, but apply it by hand as planned."),
      fix: "Apply it from src/db/migrations (runbook 1.3).",
    });
  }

  const rupees = f.featuresOn.includes("rupeePrices");
  add({
    key: "db_store_item",
    group: "Database",
    label: "Store payment type (rupee prices)",
    status: !rupees ? "info" : f.storeItemOrderKind ? "ok" : "missing",
    detail: !rupees
      ? f.storeItemOrderKind
        ? "Present (rupee prices are switched off)."
        : "Only needed once rupee prices are switched on."
      : f.storeItemOrderKind
        ? "payments.order_kind has store_item."
        : "payments.order_kind has no store_item; the first rupee checkout adds it, but run the migration to be sure.",
    fix: "Run migration 10, 20261020_origin_now_store_item_order_kind.sql, on its own (runbook 1.3).",
  });

  const storeRefunds = f.featuresOn.includes("merch") || rupees;
  add({
    key: "db_store_refund",
    group: "Database",
    label: "Store refunds in the coin ledger",
    status: !storeRefunds ? "info" : f.storeRefundKind ? "ok" : "warn",
    detail: f.storeRefundKind
      ? "now.ledger_transfers accepts store_refund."
      : storeRefunds
        ? "Not yet allowed; the first cancelled store order adds it, but run the migration to be sure."
        : "Only needed once merch or rupee prices are switched on.",
    fix: "Run migration 13, 20261020_origin_now_store_refund_kind.sql (runbook 1.3).",
  });

  // Services (environment variables, never their values).
  const service = (key: string, label: string, ok: boolean, required: boolean, okText: string, badText: string, fix: string) =>
    add({ key, group: "Services", label, status: ok ? "ok" : required ? "missing" : "warn", detail: ok ? okText : badText, fix });
  service("env_redis", "Solver presence (Upstash Redis)", f.env.redis, true, "Set.", "Not set: nobody can go online, so no human gets offers.", "Set UPSTASH_REDIS_REST_URL and _TOKEN (runbook 1.1).");
  service("env_livekit", "Live calls (LiveKit)", f.env.livekit, true, "Set.", "Not set: calls and the bot cannot start.", "Set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET (runbook 1.1).");
  service("env_recording", "Call recording storage", f.env.recording, true, "Set.", "Not set: calls are not recorded. Do not run the pilot with minors like this.", "Set NOW_RECORDING_R2_ACCESS_KEY_ID and _SECRET_ACCESS_KEY (runbook 1.1).");
  add({
    key: "env_recording_bucket",
    group: "Services",
    label: "Recording bucket (private)",
    status: f.env.recordingBucket === "ok" ? "ok" : "missing",
    detail:
      f.env.recordingBucket === "ok"
        ? "Set, and not the public image bucket. Keep public access off for it in Cloudflare."
        : f.env.recordingBucket === "public"
          ? "It is the public image bucket (R2_BUCKET_NAME), where anyone with a file's address can open it, so calls are not recorded."
          : "No private bucket set: calls are not recorded. Do not run the pilot with minors like this.",
    fix: "Set NOW_RECORDING_R2_BUCKET (or R2_PRIVATE_BUCKET) to a bucket with public access off, never R2_BUCKET_NAME (runbook 1.1, 1.2).",
  });
  add({
    key: "env_private_files",
    group: "Services",
    label: "Private file bucket (KYC documents, papers)",
    status: f.env.privateFiles === "ok" ? "ok" : "missing",
    detail:
      f.env.privateFiles === "ok"
        ? "Set, and not the public image bucket. Keep public access off for it in Cloudflare."
        : f.env.privateFiles === "public"
          ? "R2_PRIVATE_BUCKET names the public image bucket, so solver documents and paid papers are refused."
          : "R2_PRIVATE_BUCKET is not set: solvers cannot upload documents and papers cannot be uploaded or downloaded.",
    fix: "Set R2_PRIVATE_BUCKET to a bucket with public access off that the app's R2 key can write and read (runbook 1.1).",
  });
  service("env_email", "Email (guardian consent)", f.env.email, true, "Set.", "Not set: guardian consent emails cannot be sent.", "Configure SES or SMTP and EMAIL_FROM (runbook 1.1).");
  service("env_cron", "Background jobs (Vercel cron)", f.env.cronSecret, true, "CRON_SECRET set.", "CRON_SECRET not set: the sweep and the nightly job are refused, so stuck offers and settlements never clear.", "Set CRON_SECRET in Vercel (runbook 1.1).");
  service("env_qstash", "Exact-time timers (QStash)", f.env.qstash, false, "Set.", "Not set: the one-minute sweep does the same work, up to a minute late.", "Optional: set QSTASH_TOKEN and signing keys (runbook 1.1).");
  service("env_razorpay", "Coin pack payments (Razorpay)", f.env.razorpay, false, "Set.", "Not set: coin packs cannot be bought.", "Set the Razorpay keys (already used by premium payments).");
  service("env_kyc", "PAN encryption key", f.env.kycKey, false, "Set.", "Not set: solvers cannot add a PAN (it is optional).", "Optional: set NOW_KYC_ENCRYPTION_KEY (runbook 1.1).");
  service("env_web_push", "Offer alerts (web push)", f.env.webPush, false, "Set.", "Not set: solvers must keep the shift screen in front.", "Optional: generate and set the NOW_WEB_PUSH_* keys (runbook 1.1).");
  service("env_fcm", "Offer alerts in the Android app (FCM)", f.env.fcm, false, "Set.", "Not set: solvers in the Android app must keep the shift screen open.", "Optional: set FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY, and ship the app with google-services.json (runbook 1.1).");

  // Setup done in /admin/now.
  add({
    key: "setup_prices",
    group: "Setup",
    label: "Session prices",
    status: f.pricesSaved ? "ok" : "missing",
    detail: yes(f.pricesSaved, "Saved.", "Still the placeholders."),
    fix: "Settings & prices → Session prices → Save (runbook 2).",
  });
  add({
    key: "setup_packs",
    group: "Setup",
    label: "Coin packs on sale",
    status: f.packsOnSale > 0 ? "ok" : "warn",
    detail: f.packsOnSale > 0 ? `${f.packsOnSale} on sale.` : "None on sale: students only have welcome coins.",
    fix: "Settings & prices → Coin packs → Put on sale (after the legal team confirms the coin terms).",
  });
  add({
    key: "setup_welcome",
    group: "Setup",
    label: "Welcome coins",
    status: f.welcomeCoinsSet ? "ok" : "warn",
    detail: yes(f.welcomeCoinsSet, "Set by an admin.", "Still the placeholder (200)."),
    fix: "Settings & prices → Welcome coins → Save settings.",
  });
  add({
    key: "setup_agreement",
    group: "Setup",
    label: "Helper Agreement",
    status: f.agreementIsDraft ? "warn" : "ok",
    detail: yes(!f.agreementIsDraft, "Version set past the draft.", "Still the draft version; the legal team's text is not in yet."),
    fix: "Legal team sign-off list (Settings & prices), then raise the version.",
  });
  add({
    key: "setup_bot",
    group: "Setup",
    label: "Origin bot",
    status: f.botRow ? "ok" : "warn",
    detail: yes(f.botRow, "Bot helper row exists.", "Not created yet; it is created the first time the bot is needed."),
    fix: "Optional: POST /api/admin/now/bot (runbook 2).",
  });
  for (const subject of Object.keys(f.solvers).sort()) {
    const n = f.solvers[subject] ?? 0;
    const pilot = (PILOT_SUBJECTS as readonly string[]).includes(subject);
    add({
      key: `setup_solvers_${subject}`,
      group: "Setup",
      label: `Verified solvers: ${subject}`,
      status: !pilot ? "info" : n >= MIN_SOLVERS_PER_PILOT_SUBJECT ? "ok" : n > 0 ? "warn" : "missing",
      detail: `${n} verified.${pilot ? ` The pilot needs at least ${MIN_SOLVERS_PER_PILOT_SUBJECT}.` : ""}`,
      fix: "Applications → approve solvers after the documents check and demo doubt.",
    });
  }
  add({
    key: "setup_cohort",
    group: "Setup",
    label: "Pilot cohort",
    status: f.cohort > 0 ? "ok" : "warn",
    detail: f.cohort > 0 ? `${f.cohort} invited.` : "Nobody invited: no student can see Origin NOW.",
    fix: "People, cohort & wallets → invite staff first for the internal test.",
  });
  add({
    key: "setup_store",
    group: "Setup",
    label: "Store items on sale",
    status: f.storeItemsOnSale > 0 ? "ok" : "warn",
    detail: f.storeItemsOnSale > 0 ? `${f.storeItemsOnSale} on sale.` : "None: solvers have nothing to spend coins on.",
    fix: "Store → add premium time or a paper and put it on sale.",
  });

  // Switches.
  add({
    key: "switch_features",
    group: "Switches",
    label: "Extra parts",
    status: "info",
    detail: f.featuresOn.length
      ? `Switched on: ${f.featuresOn.map((k) => FEATURE_NAMES[k] ?? k).join(", ")}.`
      : "None switched on: the pilot runs exactly as planned.",
    fix: "Settings & prices → Extra parts. Run the matching rows of section F of the internal test for each one switched on.",
  });
  add({
    key: "switch_flag",
    group: "Switches",
    label: "Feature flag",
    status: "info",
    detail: f.flagOn ? "TEACHER_LAUNCH_ORIGIN_NOW is on." : "TEACHER_LAUNCH_ORIGIN_NOW is off: nobody outside the admin console sees Origin NOW.",
    fix: f.flagOn ? undefined : "Turn it on in Vercel once everything above is ready (runbook 1.4).",
  });
  add({
    key: "switch_kill",
    group: "Switches",
    label: "Kill switch",
    status: f.killSwitchOn === null ? "warn" : f.killSwitchOn ? "missing" : "ok",
    detail:
      f.killSwitchOn === null
        ? "Could not read the kill-switch state; check /admin/incidents."
        : f.killSwitchOn
          ? "originNow is killed: every Origin NOW change is refused."
          : "Not engaged.",
    fix: "/admin/incidents → clear the originNow override when the incident is over.",
  });
  return items;
}

/** Ready when nothing is missing (warnings are allowed, but listed). */
export function launchVerdict(items: readonly CheckItem[]): { ready: boolean; missing: number; warnings: number } {
  const missing = items.filter((i) => i.status === "missing").length;
  return { ready: missing === 0, missing, warnings: items.filter((i) => i.status === "warn").length };
}
