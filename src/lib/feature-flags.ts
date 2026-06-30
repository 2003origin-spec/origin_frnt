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
  | "ogcodePublishing"
  | "documentImport"
  | "adminControlCenter"
  | "paidEnrollment"
  | "premiumSubscriptions"
  | "teacherConnect"
  | "teacherOgcode"
  | "liveRooms"
  | "studentSocial"
  | "dppQuestionBank"
  | "batchSyllabus"
  | "batchHub"
  | "instituteApprovalGate"
  | "ogcodeHallmark"
  | "adminPricing"
  | "adminCoupons"
  | "adminSubAdmins";

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
  // auto-stop, post-test leaderboard + analytics, and hard delete. Ships **dark**
  // in prod (TEACHER_LAUNCH_LIVE_ROOMS=1 to enable) until verified end-to-end;
  // enabled in dev by default. Gates the new live surfaces/routes; the existing
  // teacherRooms CRUD stays independently flagged.
  liveRooms: { envSuffix: "LIVE_ROOMS", defaultDev: true, defaultProd: false },
  // Student Social — LeetCode/GitHub-style follow: @username handles, public
  // profiles at /u/<username> (rank + badges + Activity Vault + recent activity),
  // one-way follow/unfollow, follower/following lists, and student search.
  // Gates /u/[username], /social, and all /api/social/* routes. Ships dark in
  // prod (TEACHER_LAUNCH_STUDENT_SOCIAL=1 to enable); on by default in dev.
  studentSocial: { envSuffix: "STUDENT_SOCIAL", defaultDev: true, defaultProd: false },
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
