export type ServiceTokenName =
  | "INTERNAL_CRON_TOKEN"
  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET` on its own schedule
  // invocations. Accepted alongside INTERNAL_CRON_TOKEN by requireCronCaller so
  // a scheduled job authenticates whether or not the two secrets were given the
  // same value on the project.
  | "CRON_SECRET"
  | "ORIGIN_AI_SERVICE_TOKEN"
  | "GRADER_SERVICE_TOKEN"
  | "ANALYTICS_SERVICE_TOKEN"
  // Phase 12: payment provider webhook secret. Provider posts order
  // status transitions (mark_paid/mark_payment_pending/mark_failed)
  // with this token; we never accept those transitions from a student
  // session, otherwise a logged-in student could mark their own
  // unpaid order as paid.
  | "PAYMENT_WEBHOOK_TOKEN";

export class ServiceAuthConfigurationError extends Error {
  constructor(tokenName: ServiceTokenName) {
    super(`${tokenName} must be configured before this service route can be used.`);
    this.name = "ServiceAuthConfigurationError";
  }
}

export function readRequiredServiceToken(tokenName: ServiceTokenName): string {
  const token = process.env[tokenName]?.trim();
  if (!token) {
    throw new ServiceAuthConfigurationError(tokenName);
  }
  return token;
}

/**
 * Constant-time string comparison. Folds the length difference in and always
 * scans the full span so an early byte mismatch can't shorten the loop. Written
 * without `node:crypto` so it is safe in the Edge middleware bundle (which
 * imports this module) as well as Node route handlers.
 */
function timingSafeStringEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export function isBearerTokenAuthorized(request: Request, tokenName: ServiceTokenName): boolean {
  let expected: string;
  try {
    expected = readRequiredServiceToken(tokenName);
  } catch {
    return false;
  }
  const provided = request.headers.get("authorization");
  if (!provided) return false;
  // Constant-time so a network timing side-channel can't recover the cron /
  // service / payment-webhook bearer token byte-by-byte.
  return timingSafeStringEqual(provided, `Bearer ${expected}`);
}
