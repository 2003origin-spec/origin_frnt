/**
 * Workspace RBAC helpers, layered on top of the platform AuthContext
 * exposed by src/server/authz.ts.
 *
 * Permission model: V1/teacher-admin-launch-plan/06-rbac-and-api-contracts.md
 *
 * Platform admins (origin_users.role = 'admin') always pass workspace
 * permission checks (admin override). Workspace status is checked here so
 * suspended workspaces become read-only for non-admins.
 */

import {
  assertFreshPrincipal,
  AuthzError,
  FRESHNESS_CHECKED_ROLES,
  type AuthContext,
  type FreshPrincipalLookup,
  requireAuth,
} from "@/server/authz";

import { getActiveMembership, getWorkspaceById } from "./store";
import type {
  TeacherWorkspace,
  WorkspaceMember,
  WorkspaceMemberRole,
  WorkspaceStatus,
} from "./types";

const OPERATIONAL_STATUSES: WorkspaceStatus[] = ["active", "trial"];

const ROLE_RANK: Record<WorkspaceMemberRole, number> = {
  owner: 5,
  admin: 4,
  teacher: 3,
  content_manager: 3,
  analyst: 2,
  support: 1,
};

export type WorkspaceAuthContext = {
  auth: AuthContext;
  workspace: TeacherWorkspace;
  membership: WorkspaceMember | null;
  isPlatformAdmin: boolean;
  effectiveRole: WorkspaceMemberRole | "platform_admin";
};

/**
 * Reads the JWT role. Safe only AFTER `loadWorkspaceContext` has run
 * `assertFreshPrincipal` for admin/teacher tokens — that is what guarantees a
 * removed or demoted sub-admin cannot keep platform-admin on workspace routes
 * for the remaining life of their access token.
 */
export function isPlatformAdmin(auth: AuthContext): boolean {
  return auth.role === "admin";
}

/** Store + principal lookups behind `loadWorkspaceContext`; injectable so the
 * freshness rule can be unit-tested without Postgres. */
export type WorkspaceContextDeps = {
  getWorkspaceById: typeof getWorkspaceById;
  getActiveMembership: typeof getActiveMembership;
  lookupPrincipal?: FreshPrincipalLookup;
};

const defaultDeps: WorkspaceContextDeps = { getWorkspaceById, getActiveMembership };

function hasMinimumRole(role: WorkspaceMemberRole, allowed: WorkspaceMemberRole[]): boolean {
  if (allowed.length === 0) return true;
  return allowed.includes(role);
}

/** Pure decision function used by requireWorkspaceMember. Exposed so
 * fuzz tests can exercise the full role × status × allowedRoles cube
 * without stubbing the request/auth/store layers. Returns null when
 * access is granted, an AuthzError otherwise. */
export function evaluateWorkspaceAccess(input: {
  auth: AuthContext;
  workspace: TeacherWorkspace | null;
  member: WorkspaceMember | null;
  allowedRoles?: WorkspaceMemberRole[];
}): AuthzError | null {
  if (!input.workspace) {
    return new AuthzError(403, "Workspace not found or access denied.");
  }
  const platformAdmin = input.auth.role === "admin";
  const member = input.member;
  if (!platformAdmin && (!member || member.status !== "active")) {
    return new AuthzError(403, "You are not a member of this workspace.");
  }
  if (platformAdmin) return null;
  if (!OPERATIONAL_STATUSES.includes(input.workspace.status)) {
    return new AuthzError(403, "This workspace is not operational.");
  }
  if (!member) {
    return new AuthzError(403, "You are not a member of this workspace.");
  }
  if (!hasMinimumRole(member.role, input.allowedRoles ?? [])) {
    return new AuthzError(403, "You do not have permission to perform this action.");
  }
  return null;
}

export async function loadWorkspaceContext(
  request: Request,
  workspaceId: string,
  deps: WorkspaceContextDeps = defaultDeps,
): Promise<WorkspaceAuthContext> {
  const auth = await requireAuth(request);
  // Same rule as `requireRole` on /api/admin/**: an admin or teacher token is
  // re-checked against the user row (status, auth_token_version, role) on every
  // request, so a revoked teacher or a removed/demoted sub-admin loses
  // workspace access immediately instead of when the JWT expires. Students
  // stay JWT-only (hot path). A lookup failure is a 503 via handleTeacherError.
  if (FRESHNESS_CHECKED_ROLES.has(auth.role)) {
    await assertFreshPrincipal(auth, deps.lookupPrincipal);
  }
  const workspace = await deps.getWorkspaceById(workspaceId);
  if (!workspace) {
    throw new AuthzError(403, "Workspace not found or access denied.");
  }
  const platformAdmin = isPlatformAdmin(auth);
  const membership = await deps.getActiveMembership(workspaceId, auth.userId);

  if (!platformAdmin && (!membership || membership.status !== "active")) {
    throw new AuthzError(403, "You are not a member of this workspace.");
  }

  return {
    auth,
    workspace,
    membership,
    isPlatformAdmin: platformAdmin,
    effectiveRole: platformAdmin && !membership ? "platform_admin" : (membership?.role ?? "owner"),
  };
}

export async function requireWorkspaceMember(
  request: Request,
  workspaceId: string,
  allowedRoles: WorkspaceMemberRole[] = [],
  deps: WorkspaceContextDeps = defaultDeps,
): Promise<WorkspaceAuthContext> {
  const context = await loadWorkspaceContext(request, workspaceId, deps);

  if (!context.isPlatformAdmin) {
    if (!OPERATIONAL_STATUSES.includes(context.workspace.status)) {
      throw new AuthzError(403, "This workspace is not operational.");
    }
    if (!context.membership) {
      throw new AuthzError(403, "You are not a member of this workspace.");
    }
    if (!hasMinimumRole(context.membership.role, allowedRoles)) {
      throw new AuthzError(403, "You do not have permission to perform this action.");
    }
  }

  return context;
}

export async function requireWorkspaceOwnerOrAdmin(
  request: Request,
  workspaceId: string,
): Promise<WorkspaceAuthContext> {
  return requireWorkspaceMember(request, workspaceId, ["owner", "admin"]);
}

export function isMutatingRoleAllowed(role: WorkspaceMemberRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK.teacher;
}

export function workspaceMembersThatCanWrite(role: WorkspaceMemberRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK.teacher;
}
