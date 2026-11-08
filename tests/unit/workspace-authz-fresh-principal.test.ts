/**
 * `/api/teacher/**` re-checks the principal like `/api/admin/**`.
 *
 * Every teacher workspace route resolves the caller through
 * `loadWorkspaceContext` / `requireWorkspaceMember`, and `isPlatformAdmin`
 * reads the JWT role. Without a freshness check a revoked teacher kept
 * workspace access, and a removed/demoted sub-admin kept platform-admin on
 * every institute's routes, until the access JWT expired (≤ 60 min).
 *
 * The store lookups are injected so this runs without Postgres; the principal
 * lookup is stubbed the same way `authz-fresh-principal.test.ts` does.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { AuthzError } from "@/server/authz";
import { AuthServiceUnavailableError } from "@/server/auth-errors";
import {
  loadWorkspaceContext,
  requireWorkspaceMember,
  type WorkspaceContextDeps,
} from "@/server/workspaces/authz";
import type { TeacherWorkspace, WorkspaceMember } from "@/server/workspaces/types";
import { handleTeacherError } from "@/app/api/teacher/_utils";
import {
  ACCESS_COOKIE_NAME,
  ACCESS_FINGERPRINT_COOKIE_NAME,
  issueAccessTokenForUser,
} from "@/server/auth-jwt";
import { withStoredUserDefaults, type StoredUser } from "@/server/store";

process.env.AUTH_JWT_SECRET_CURRENT = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY";

const WORKSPACE_ID = "ws_institute_1";
const NOW = new Date(0).toISOString();

function buildUser(patch: Partial<StoredUser> = {}): StoredUser {
  return withStoredUserDefaults({
    id: "user_teacher_1",
    name: "Teacher",
    email: "teacher@example.com",
    password: "",
    role: "teacher",
    studentClass: null,
    fieldOfInterest: null,
    referralSource: null,
    avatar: null,
    streak: 0,
    totalStudyTime: 0,
    joinedAt: NOW,
    isPremium: false,
    premiumExpiry: null,
    isOnboarded: true,
    selectedCourse: null,
    isDropper: false,
    yearsOfExperience: "3",
    subjects: ["physics"],
    studentCapacity: null,
    authTokenVersion: 2,
    ...patch,
  });
}

const workspace: TeacherWorkspace = {
  id: WORKSPACE_ID,
  workspaceType: "institute",
  ownerUserId: "user_owner_0",
  displayName: "Institute",
  legalName: null,
  slug: null,
  logoAssetId: null,
  city: null,
  state: null,
  country: "IN",
  subjects: [],
  courses: [],
  status: "active",
  verificationStatus: "verified",
  publicProfile: {},
  settings: {},
  codeAccessStatus: "legacy",
  studentQuota: null,
  codeAiAccess: null,
  createdAt: NOW,
  updatedAt: NOW,
};

function membershipFor(userId: string): WorkspaceMember {
  return {
    workspaceId: WORKSPACE_ID,
    userId,
    role: "teacher",
    status: "active",
    invitedBy: null,
    joinedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

/** Stub store + principal lookup. `row` is what the user table holds NOW; the
 * JWT in the request is minted from whatever the caller passes separately. */
function depsFor(options: {
  row: StoredUser | null | (() => Promise<StoredUser | null>);
  member?: boolean;
  onLookup?: () => void;
}): WorkspaceContextDeps {
  return {
    getWorkspaceById: async (id) => (id === WORKSPACE_ID ? workspace : null),
    getActiveMembership: async (_workspaceId, userId) => (options.member === false ? null : membershipFor(userId)),
    lookupPrincipal: async () => {
      options.onLookup?.();
      return typeof options.row === "function" ? options.row() : options.row;
    },
  };
}

async function requestFor(user: StoredUser): Promise<Request> {
  const issued = await issueAccessTokenForUser(user, "sess_test");
  return new Request(`https://www.o3origin.com/api/teacher/workspaces/${WORKSPACE_ID}`, {
    headers: {
      cookie: `${ACCESS_COOKIE_NAME}=${issued.accessToken}; ${ACCESS_FINGERPRINT_COOKIE_NAME}=${issued.accessFingerprint}`,
    },
  });
}

async function rejectsWith401(run: () => Promise<unknown>) {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof AuthzError, "expected an AuthzError");
    assert.equal(error.status, 401);
    assert.equal(handleTeacherError(error).status, 401);
    return true;
  });
}

test("a current teacher member passes and gets their membership", async () => {
  const teacher = buildUser();
  const ctx = await requireWorkspaceMember(await requestFor(teacher), WORKSPACE_ID, [], depsFor({ row: teacher }));
  assert.equal(ctx.auth.userId, teacher.id);
  assert.equal(ctx.isPlatformAdmin, false);
  assert.equal(ctx.effectiveRole, "teacher");
});

test("a revoked teacher gets 401 on a workspace route even with an active membership", async () => {
  const teacher = buildUser();
  const request = await requestFor(teacher);
  const revokedRow = buildUser({ accountStatus: "revoked" });
  await rejectsWith401(() => requireWorkspaceMember(request, WORKSPACE_ID, [], depsFor({ row: revokedRow })));
  await rejectsWith401(() => loadWorkspaceContext(request, WORKSPACE_ID, depsFor({ row: revokedRow })));
});

test("a teacher whose auth_token_version moved (sign-out everywhere) gets 401", async () => {
  const teacher = buildUser();
  const request = await requestFor(teacher);
  const bumped = buildUser({ authTokenVersion: 3 });
  await rejectsWith401(() => requireWorkspaceMember(request, WORKSPACE_ID, [], depsFor({ row: bumped })));
});

test("a removed sub-admin loses platform-admin on every workspace route", async () => {
  // JWT still says role: admin with version 2; removeSubAdmin bumped the row
  // and demoted it to student. Previously isPlatformAdmin(auth) passed from
  // the token alone, with no membership needed.
  const subAdmin = buildUser({ id: "user_subadmin_1", role: "admin", email: "sub@example.com" });
  const request = await requestFor(subAdmin);
  const demotedRow = buildUser({ id: "user_subadmin_1", role: "student", email: "sub@example.com", authTokenVersion: 3 });
  await rejectsWith401(() => loadWorkspaceContext(request, WORKSPACE_ID, depsFor({ row: demotedRow, member: false })));
  await rejectsWith401(() =>
    requireWorkspaceMember(request, WORKSPACE_ID, ["owner", "admin"], depsFor({ row: demotedRow, member: false })),
  );
});

test("a demoted sub-admin whose version did not move is still refused (role mismatch)", async () => {
  const subAdmin = buildUser({ id: "user_subadmin_2", role: "admin", email: "sub2@example.com" });
  const request = await requestFor(subAdmin);
  const demotedRow = buildUser({ id: "user_subadmin_2", role: "student", email: "sub2@example.com" });
  await rejectsWith401(() => loadWorkspaceContext(request, WORKSPACE_ID, depsFor({ row: demotedRow, member: false })));
});

test("a current platform admin still gets the admin override without a membership", async () => {
  const admin = buildUser({ id: "user_admin_1", role: "admin", email: "admin@example.com" });
  const ctx = await requireWorkspaceMember(
    await requestFor(admin),
    WORKSPACE_ID,
    ["owner", "admin"],
    depsFor({ row: admin, member: false }),
  );
  assert.equal(ctx.isPlatformAdmin, true);
  assert.equal(ctx.effectiveRole, "platform_admin");
});

test("a principal lookup failure is a 503 through handleTeacherError, never a pass", async () => {
  const teacher = buildUser();
  const request = await requestFor(teacher);
  const deps = depsFor({
    row: async () => {
      throw new Error("connection reset");
    },
  });
  await assert.rejects(
    requireWorkspaceMember(request, WORKSPACE_ID, [], deps),
    (error: unknown) => {
      assert.ok(error instanceof AuthServiceUnavailableError);
      assert.equal(handleTeacherError(error).status, 503);
      return true;
    },
  );
});

test("the freshness check runs before any workspace lookup", async () => {
  const teacher = buildUser();
  const request = await requestFor(teacher);
  let workspaceLookups = 0;
  const deps: WorkspaceContextDeps = {
    ...depsFor({ row: buildUser({ accountStatus: "deleted" }) }),
    getWorkspaceById: async () => {
      workspaceLookups += 1;
      return workspace;
    },
  };
  await rejectsWith401(() => loadWorkspaceContext(request, WORKSPACE_ID, deps));
  assert.equal(workspaceLookups, 0, "a stale principal never reaches the workspace store");
});

test("students stay JWT-only: no principal lookup, stale version still passes", async () => {
  const student = buildUser({ id: "user_student_1", role: "student", email: "s@example.com", authTokenVersion: 9 });
  const request = await requestFor(student);
  let lookups = 0;
  const ctx = await loadWorkspaceContext(
    request,
    WORKSPACE_ID,
    depsFor({ row: buildUser({ id: "user_student_1", role: "student", authTokenVersion: 1 }), onLookup: () => (lookups += 1) }),
  );
  assert.equal(ctx.auth.userId, student.id);
  assert.equal(lookups, 0, "student requests never hit the principal lookup");
});
