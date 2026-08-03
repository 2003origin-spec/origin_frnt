/**
 * Per-phase feature flags for the teacher/institute/admin launch.
 * Each flag is independent so phases can ship without entangling rollback.
 *
 * Source: V1/teacher-admin-launch-plan/05-implementation-roadmap.md
 *
 * After all 13 phases shipped to production, defaults are flipped on
 * for both dev and prod so the launch surfaces are visible by default.
 * Individual flags can still be flipped off per-environment via the
 * `TEACHER_LAUNCH_<SUFFIX>` env var or via the runtime kill-switch in
 * /admin/incidents (which calls setFlagOverride and overrides the
 * default at request time).
 */

const FLAG_ENV_PREFIX = "TEACHER_LAUNCH_";

type FlagKey =
  | "workspaces"
  | "orgCodes"
  | "enrollment"
  | "batches"
  | "questionBag"
  | "teacherTests"
  | "teacherRooms"
  | "studyMaterials"
  | "teacherAnalytics"
  | "teacherDeepAnalytics"
  | "ogcodePublishing"
  | "documentImport"
  | "adminControlCenter"
  | "paidEnrollment"
  | "premiumSubscriptions"
  | "teacherConnect"
  | "teacherOgcode"
  | "liveRooms"
  | "studentSocial"
  | "cbtModule"
  | "dppQuestionBank"
  | "batchSyllabus"
  | "batchHub"
  | "instituteApprovalGate"
  | "ogcodeHallmark"
  | "adminPricing"
  | "adminCoupons"
  | "adminSubAdmins"
  | "odgTeacherRanking"
  | "adminPremiumAccess"
  | "aiAccessControls"
  | "ogcodeScoringV2"
  | "teacherCodeApproval"
  | "adminUserLifecycle"
  | "studyModes";

type FlagSpec = {
  envSuffix: string;
  defaultDev: boolean;
  defaultProd: boolean;
};

const FLAG_SPECS: Record<FlagKey, FlagSpec> = {
  workspaces:        { envSuffix: "WORKSPACES",          defaultDev: true,  defaultProd: true },
  orgCodes:          { envSuffix: "ORG_CODES",           defaultDev: true,  defaultProd: true },
  enrollment:        { envSuffix: "ENROLLMENT",          defaultDev: true,  defaultProd: true },
  batches:           { envSuffix: "BATCHES",             defaultDev: true,  defaultProd: true },
  questionBag:       { envSuffix: "QUESTION_BAG",        defaultDev: true,  defaultProd: true },
  teacherTests:      { envSuffix: "TEACHER_TESTS",       defaultDev: true,  defaultProd: true },
  teacherRooms:      { envSuffix: "TEACHER_ROOMS",       defaultDev: true,  defaultProd: true },
  studyMaterials:    { envSuffix: "STUDY_MATERIALS",     defaultDev: true,  defaultProd: true },
  teacherAnalytics:  { envSuffix: "TEACHER_ANALYTICS",   defaultDev: true,  defaultProd: true },
  // Teacher Analytics Deep-Dive — the Overview / Batches / Students analytics
  // upgrade (V1/allmd/TEACHER_ANALYTICS_DEEP_DIVE_PLAN_2026-08-03.md): workspace
  // KPI + batch comparison + subject×batch heatmap on Overview, a batch Analytics
  // deep-dive tab, and the 360° student profile behind a searchable directory.
  // Gates ONLY the added analytics blocks and their `?type=` API branches — with
  // this OFF all three sections render exactly the pre-upgrade UI, so the env var
  // is a full one-flip rollback without reverting a deploy.
  teacherDeepAnalytics: { envSuffix: "TEACHER_DEEP_ANALYTICS", defaultDev: true, defaultProd: true },
  ogcodePublishing:  { envSuffix: "OGCODE_PUBLISHING",   defaultDev: true,  defaultProd: true },
  documentImport:    { envSuffix: "DOCUMENT_IMPORT",     defaultDev: true,  defaultProd: true },
  adminControlCenter:{ envSuffix: "ADMIN_CONTROL",       defaultDev: true,  defaultProd: true },
  paidEnrollment:    { envSuffix: "PAID_ENROLLMENT",     defaultDev: true,  defaultProd: true },
  // Phase 13 — Free vs Premium per-subject subscriptions. Shipped + enabled in
  // production (TEACHER_LAUNCH_PREMIUM_SUBSCRIPTIONS=1); defaults flipped ON to
  // match prod and remove the silent dark default. Per-env env var still overrides.
  premiumSubscriptions: { envSuffix: "PREMIUM_SUBSCRIPTIONS", defaultDev: true, defaultProd: true },
  // Phase 14 — Student ↔ teacher connection (collaborations, /connect, both
  // enrollment flows, teacher tests/rooms → student, teacher analytics). Shipped +
  // enabled in production (TEACHER_LAUNCH_TEACHER_CONNECT=1); defaults flipped ON.
  teacherConnect: { envSuffix: "TEACHER_CONNECT", defaultDev: true, defaultProd: true },
  // Phase 15 — Teacher OG Code bank browse + OG-Code-as-a-source in the test
  // builder (general + room tests). Shipped + enabled in production; defaults
  // flipped ON. The Phase-0 mixed-source take/grade fix is unflagged (correctness).
  teacherOgcode: { envSuffix: "TEACHER_OGCODE", defaultDev: true, defaultProd: true },
  // Teacher Live Rooms — real-time room shell (chat + typing + presence),
  // 60s rotating / permanent join codes, kick + participant search, Start-Test
  // auto-stop, post-test leaderboard + analytics, and hard delete. Shipped +
  // enabled in production; defaults flipped ON. Gates the new live surfaces/routes;
  // the existing teacherRooms CRUD stays independently flagged.
  liveRooms: { envSuffix: "LIVE_ROOMS", defaultDev: true, defaultProd: true },
  // Student Social — LeetCode/GitHub-style follow: @username handles, public
  // profiles at /u/<username> (rank + badges + Activity Vault + recent activity),
  // one-way follow/unfollow, follower/following lists, and student search.
  // Gates /u/[username], /social, and all /api/social/* routes. Shipped +
  // enabled in production; defaults flipped ON. Migration 20260623_student_social.sql
  // must be applied against Neon before the first prod deploy with this enabled.
  studentSocial: { envSuffix: "STUDENT_SOCIAL", defaultDev: true, defaultProd: true },
  // CBT Platform (o3origin.com/cbt) — standalone Computer-Based-Test SaaS for
  // allowlisted CBT teachers + anonymous students. Gates /cbt, /cbt/r,
  // /api/cbt/*, /api/cbt-student/*, /api/admin/cbt/*. Shipped + enabled in
  // production; defaults flipped ON (per the launch convention). REQUIRES
  // CBT_PARTICIPANT_TOKEN_SECRET (>=32 chars) set in prod and the
  // 20260705_cbt_module.sql origin_users role-CHECK applied to Neon before the
  // first prod deploy with this enabled. Per-env env var still overrides.
  cbtModule: { envSuffix: "CBT", defaultDev: true, defaultProd: true },
  // Question-Bag-aware DPP generation — after a teacher-assigned test, prefer the
  // owning workspace's Question Bag for the relevant weak topics, fall back to OG
  // Code with a provenance note, and tenant-isolate bag-sourced DPPs to students
  // actively enrolled in that workspace. Gates the bag-preference override; when
  // off, DPP generation behaves exactly as before (OG Code only). Live in prod.
  dppQuestionBank: { envSuffix: "DPP_QUESTION_BANK", defaultDev: true, defaultProd: true },
  // Batch Syllabus — real teacher-owned syllabus tree (chapter/topic CRUD) with
  // progress derived from student mastery + manual override, replacing the mock
  // syllabus on the batch-detail page. Gates the syllabus API + UI. Live in prod.
  batchSyllabus: { envSuffix: "BATCH_SYLLABUS", defaultDev: true, defaultProd: true },
  // Batch Hub — per-batch study-material sharing (R2 uploads + pasteable links)
  // and a polling-based message feed visible to teacher and enrolled students
  // (teacher batch detail + student /connect batch view). Live in prod.
  batchHub: { envSuffix: "BATCH_HUB", defaultDev: true, defaultProd: true },
  // Admin Control Plane — institute approval gate. When ON, student Browse only
  // shows institutes/teachers with an `active` collaboration (admin-approved),
  // and every new workspace lands in /admin/collaborations as `pending`. When
  // OFF, Browse falls back to the pre-#201 behaviour (all active institutes).
  // LIVE in prod (default on). Existing institutes are auto-backfilled to
  // `pending` by the collaboration runtime-ensure, so the admin reviews them.
  instituteApprovalGate: { envSuffix: "INSTITUTE_APPROVAL_GATE", defaultDev: true, defaultProd: true },
  // Admin Control Plane — OG-Code hallmark. Gates the teacher→publication submit
  // path, the publish→student-catalog writer, and the student-side institute
  // attribution badge + contributed filter. LIVE in prod (default on).
  ogcodeHallmark: { envSuffix: "OGCODE_HALLMARK", defaultDev: true, defaultProd: true },
  // Admin Control Plane — admin-editable per-subject + bundle pricing. Gates the
  // /admin/pricing surface and the DB-backed price resolution in checkout.
  // LIVE in prod (default on). Price display falls back to ₹499 + env plan until
  // an admin sets an override, so it is safe before any Razorpay plan is created.
  adminPricing: { envSuffix: "ADMIN_PRICING", defaultDev: true, defaultProd: true },
  // Admin Control Plane — coupon codes for platform subject/bundle subscriptions.
  // Gates /admin/coupons, validation/redemption, and the student coupon input.
  // LIVE in prod (default on).
  adminCoupons: { envSuffix: "ADMIN_COUPONS", defaultDev: true, defaultProd: true },
  // Admin Control Plane — sub-admin management (main-admin creates sub-admins by
  // name+email). Gates /api/admin/admins + the admins UI. LIVE in prod (default
  // on). The main admin is recognised by PLATFORM_MAIN_ADMIN_EMAIL even without
  // the is_main_admin flag set, so no seed run is required.
  adminSubAdmins: { envSuffix: "ADMIN_SUB_ADMINS", defaultDev: true, defaultProd: true },
  // Admin Premium Pro access console — the /admin/premium-access toggle that
  // grants/revokes admin_comp Premium Pro to free students (+ Event Mode). Gates
  // /api/admin/premium-access/* and the page. Kill-switch parity with the other
  // admin tools; LIVE in prod (default on). Note: granted comp only UNLOCKS
  // premium features for students while premiumSubscriptions/teacherConnect is on.
  adminPremiumAccess: { envSuffix: "ADMIN_PREMIUM_ACCESS", defaultDev: true, defaultProd: true },
  // Origin Diagnostic Graph — teacher-coefficient marketplace ranking (Phase 3).
  // When ON, public institute browse is re-ranked by ODG node-activation scores
  // (which teacher's content most reliably lifts mastery) on top of the existing
  // verification/recency order. Ships DARK: coefficients are shadow-computed first
  // and validated before this is enabled. Requires ANALYTICS_SERVICE_URL.
  odgTeacherRanking: { envSuffix: "ODG_TEACHER_RANKING", defaultDev: false, defaultProd: false },
  // AI Feature Toggle epic — admin-controlled per-scope AI kill switches
  // (V1/ai-feature-toggle/). Gates the toggle subsystem + /admin/ai-access +
  // /api/admin/ai-access. Compiled defaults ON → zero new env vars. The
  // student-only role rule (D4) is deliberately NOT behind this flag.
  aiAccessControls: { envSuffix: "AI_ACCESS_CONTROLS", defaultDev: true, defaultProd: true },
  // OGCode Scoring V2 — CS_core scoring engine (V1/OGCODE_SCORING_ALGORITHM.md):
  // per-difficulty base score/time with time decay, per-(student, question)
  // attempt caps (MCQ 3, Numerical/Range 4) with in-place retries, JEE Advanced
  // marking for MSQ/Matrix Match, and hint/answer reveal decay (bs/2 / 0).
  // Ships DARK: when off, submission grading + points behave exactly as before.
  // Requires migration 20260712_ogcode_scoring_v2.sql on the OGCODE database.
  ogcodeScoringV2: { envSuffix: "OGCODE_SCORING_V2", defaultDev: false, defaultProd: false },
  // Teacher Code Access (admin-gated) — replaces auto-issuing a student_join code
  // at onboarding with a request → admin-approve-with-quota flow, plus quota
  // enforcement + auto-revoke at the cap. Gates onboarding auto-issue skip, the
  // teacher request UI/endpoints, the admin request console, and quota
  // enforcement. Ships DARK (defaultProd:false): when OFF the app behaves exactly
  // as before (auto-issue, no quota). Grandfathered workspaces (student_quota
  // NULL) are never enforced. See V1/allmd/TEACHER_CODE_ACCESS_AND_USER_LIFECYCLE_PLAN.md.
  teacherCodeApproval: { envSuffix: "TEACHER_CODE_APPROVAL", defaultDev: true, defaultProd: false },
  // Admin user lifecycle — the /admin/users Revoke / Delete actions. Gates ONLY
  // the admin action UIs/endpoints. Ships DARK (defaultProd:false). NOTE: the
  // *enforcement* (login-gating of revoked/deleted accounts + re-signup block by
  // email/phone) is deliberately UNCONDITIONAL — it always respects
  // origin_users.account_status and the deleted-identity blocklist regardless of
  // this flag, so flipping the flag off can never un-ban a bad actor.
  adminUserLifecycle: { envSuffix: "ADMIN_USER_LIFECYCLE", defaultDev: true, defaultProd: false },
  // Study Mode (JEE / NEET / PCMB) — the student-side single-select that scopes
  // every subject-tagged surface (OG Code, Daily Mission, Test Builder, DPP, room
  // test config, Doubt Solver, leaderboard arenas, Study Corner, search) to the
  // subjects of the chosen mode. Ships ENABLED in dev AND prod — no env var
  // required; TEACHER_LAUNCH_STUDY_MODES still overrides per-environment and is
  // the kill switch if anything goes wrong. Turning it OFF makes getStudentScope
  // report `enforced:false` with ALL_SUBJECTS, so every gate becomes a no-op and
  // the app behaves exactly as it did before the feature.
  // REQUIRES both migrations against Neon: 20260801_user_study_mode.sql (USER db)
  // and 20260801_ogcode_daily_challenge_mode.sql (OGCODE db). Both are also
  // mirrored by runtime-ensure blocks (db-users.ts / ogcode-catalog.ts), so an
  // un-migrated database self-heals on first request rather than erroring.
  // See V1/allmd/STUDY_MODE_JEE_NEET_PCMB_PLAN_2026-08-01.md.
  studyModes: { envSuffix: "STUDY_MODES", defaultDev: true, defaultProd: true },
};

/** Every feature-flag key, in declaration order (admin System Config view). */
export const ALL_FLAG_KEYS = Object.keys(FLAG_SPECS) as FlagKey[];

function parseFlag(raw: string | undefined): boolean | null {
  if (raw == null) return null;
  const lowered = raw.trim().toLowerCase();
  if (lowered === "1" || lowered === "true" || lowered === "on" || lowered === "yes") return true;
  if (lowered === "0" || lowered === "false" || lowered === "off" || lowered === "no") return false;
  return null;
}

export function isFeatureEnabled(flag: FlagKey): boolean {
  const spec = FLAG_SPECS[flag];
  const explicit = parseFlag(process.env[`${FLAG_ENV_PREFIX}${spec.envSuffix}`]);
  if (explicit !== null) return explicit;
  const isProd = process.env.NODE_ENV === "production";
  return isProd ? spec.defaultProd : spec.defaultDev;
}

export function requireFeatureEnabled(flag: FlagKey): void {
  if (!isFeatureEnabled(flag)) {
    throw new FeatureDisabledError(flag);
  }
}

export class FeatureDisabledError extends Error {
  flag: FlagKey;
  constructor(flag: FlagKey) {
    super(`Feature '${flag}' is not enabled in this environment.`);
    this.flag = flag;
  }
}

export type { FlagKey };
