/**
 * Error → HTTP mapping shared by the Origin NOW route catch-alls, so every
 * handler can just throw. Codes are stable strings the UI switches on.
 */

import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { FeatureDisabledError } from "@/lib/feature-flags";
import { AuthzError, authzErrorResponse } from "@/server/authz";

import { FrozenAccountError, InsufficientCoinsError } from "./ledger-store";

export class NowError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function nowJson<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function handleNowError(error: unknown, scope = "now"): NextResponse {
  if (error instanceof FeatureDisabledError) {
    return NextResponse.json({ detail: "Not found.", code: "feature_off" }, { status: 404 });
  }
  if (error instanceof AuthzError) return authzErrorResponse(error) as NextResponse;
  if (error instanceof NowError) {
    return NextResponse.json({ detail: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof InsufficientCoinsError) {
    return NextResponse.json(
      { detail: error.message, code: "insufficient_coins", available: error.available, needed: error.needed },
      { status: 409 },
    );
  }
  if (error instanceof FrozenAccountError) {
    return NextResponse.json({ detail: "This wallet is on hold while a report is reviewed.", code: "wallet_frozen" }, { status: 423 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { detail: "Invalid request.", code: "invalid", issues: error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) },
      { status: 400 },
    );
  }
  console.error(`[${scope} api] unexpected error`, error instanceof Error ? error.message : error);
  return NextResponse.json({ detail: "Internal server error.", code: "internal" }, { status: 500 });
}
