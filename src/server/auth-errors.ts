export class AuthServiceUnavailableError extends Error {
  constructor(message = "Authentication service is temporarily unavailable.") {
    super(message);
    this.name = "AuthServiceUnavailableError";
  }
}

export function isAuthServiceUnavailableError(error: unknown): error is AuthServiceUnavailableError {
  return error instanceof AuthServiceUnavailableError;
}
