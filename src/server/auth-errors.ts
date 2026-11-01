export class AuthServiceUnavailableError extends Error {
  constructor(message = "Authentication service is temporarily unavailable.") {
    super(message);
    this.name = "AuthServiceUnavailableError";
  }
}

export function isAuthServiceUnavailableError(error: unknown): error is AuthServiceUnavailableError {
  return error instanceof AuthServiceUnavailableError;
}

/**
 * Why a session could not be minted or rotated for an otherwise-known user:
 *   revoked / deleted → `origin_users.account_status` is not "active"
 *   stale             → the caller's `auth_token_version` no longer matches the
 *                       row (a revoke/delete/sub-admin removal bumped it)
 *
 * Callers map this to the precise 403 (`accountStatusBlock`) or a 401 — never
 * to the 503 that a genuine DB hiccup gets.
 */
export type AccountBlockReason = "revoked" | "deleted" | "stale";

export class AccountBlockedError extends Error {
  status: number;
  reason: AccountBlockReason;

  constructor(reason: AccountBlockReason, message?: string) {
    super(message ?? `Account is ${reason === "stale" ? "no longer valid for this session" : reason}.`);
    this.name = "AccountBlockedError";
    this.reason = reason;
    this.status = reason === "stale" ? 401 : 403;
  }
}

export function isAccountBlockedError(error: unknown): error is AccountBlockedError {
  return error instanceof AccountBlockedError;
}
