/**
 * Typed payment errors that carry a definitive HTTP meaning.
 *
 * Kept in a dependency-free module so routes, tests and the client-facing
 * response mapper can tell a domain rejection from a transient failure without
 * importing the whole Rail-A service graph (which is `server-only`).
 */

/**
 * A capture that can NEVER succeed as sent: unknown order (404), a payment that
 * contradicts the local order (409), or a malformed request (422). Anything
 * thrown by the payment path that is not one of these is treated as transient
 * (pool exhausted, DDL lock timeout, Neon cold start) — the webhook and the
 * reconcile will still apply the capture.
 */
export class PaymentDomainError extends Error {
  readonly status: 404 | 409 | 422;

  constructor(status: 404 | 409 | 422, message: string) {
    super(message);
    this.name = "PaymentDomainError";
    this.status = status;
  }
}

export function isPaymentDomainError(error: unknown): error is PaymentDomainError {
  return error instanceof PaymentDomainError;
}
