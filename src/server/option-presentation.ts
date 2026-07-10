import { createHmac, timingSafeEqual } from "node:crypto";

export type OptionPresentationScope =
  | "test"
  | "custom-test"
  | "room-test"
  | "dpp"
  | "practice"
  | "challenge";

export type OptionPresentationPayload = {
  v: 1;
  u: string;
  s: OptionPresentationScope;
  a: string;
  q: string;
  k: string;
  n: number;
};

export type OptionPresentationContext = {
  userId: string;
  scope: OptionPresentationScope;
  assessmentId: string;
  questionId: string;
  attemptKey: string | number;
  optionCount: number;
};

const TOKEN_VERSION = 1;

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string | null {
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

function getOptionPresentationSecret(explicitSecret?: string): string {
  const secret =
    explicitSecret ??
    process.env.OPTION_SHUFFLE_SECRET ??
    process.env.ROOM_CODE_SECRET ??
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("OPTION_SHUFFLE_SECRET must be configured in production.");
  }

  return "origin-dev-option-shuffle-secret";
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function signaturesMatch(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function assertPayload(value: unknown): OptionPresentationPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const payload = value as Partial<OptionPresentationPayload>;
  if (
    payload.v !== TOKEN_VERSION ||
    typeof payload.u !== "string" ||
    typeof payload.s !== "string" ||
    typeof payload.a !== "string" ||
    typeof payload.q !== "string" ||
    typeof payload.k !== "string" ||
    typeof payload.n !== "number" ||
    !Number.isInteger(payload.n) ||
    payload.n < 0
  ) {
    return null;
  }
  return payload as OptionPresentationPayload;
}

export function createOptionPresentationToken(
  context: OptionPresentationContext,
  explicitSecret?: string,
): string {
  const payload: OptionPresentationPayload = {
    v: TOKEN_VERSION,
    u: context.userId,
    s: context.scope,
    a: context.assessmentId,
    q: context.questionId,
    k: String(context.attemptKey),
    n: context.optionCount,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${signPayload(encodedPayload, getOptionPresentationSecret(explicitSecret))}`;
}

export function verifyOptionPresentationToken(
  token: string | null | undefined,
  expected: Pick<OptionPresentationContext, "userId" | "questionId" | "optionCount"> &
    Partial<Pick<OptionPresentationContext, "scope" | "assessmentId">>,
  explicitSecret?: string,
): OptionPresentationPayload | null {
  if (!token || typeof token !== "string") {
    return null;
  }
  const [encodedPayload, signature, extra] = token.split(".");
  if (!encodedPayload || !signature || extra !== undefined) {
    return null;
  }
  const expectedSignature = signPayload(encodedPayload, getOptionPresentationSecret(explicitSecret));
  if (!signaturesMatch(signature, expectedSignature)) {
    return null;
  }
  const decoded = base64UrlDecode(encodedPayload);
  if (!decoded) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    return null;
  }
  const payload = assertPayload(parsed);
  if (!payload) {
    return null;
  }
  if (
    payload.u !== expected.userId ||
    payload.q !== expected.questionId ||
    payload.n !== expected.optionCount ||
    (expected.scope && payload.s !== expected.scope) ||
    (expected.assessmentId && payload.a !== expected.assessmentId)
  ) {
    return null;
  }
  return payload;
}

export function getOptionDisplayOrder(
  payload: OptionPresentationPayload,
  explicitSecret?: string,
): number[] {
  // Option shuffling is intentionally DISABLED — options are presented in their
  // authored order. This is the single chokepoint used by both option
  // presentation (serializeQuestion → presentOptions) and answer grading
  // (remapPresentedAnswer / toPresentedGradeInfo), so returning the identity
  // order keeps the two sides self-consistent and grading correct while the
  // signed presentation-token contract stays intact.
  //
  // To re-enable a deterministic per-attempt shuffle, restore the HMAC rank
  // sort below (kept in git history) instead of this identity order.
  void explicitSecret;
  return Array.from({ length: payload.n }, (_, index) => index);
}

export function presentOptions<T>(
  options: T[] | null | undefined,
  context: Omit<OptionPresentationContext, "optionCount">,
): { options: T[] | undefined; presentationId: string | undefined } {
  if (!options?.length) {
    return { options: options ?? undefined, presentationId: undefined };
  }

  const presentationId = createOptionPresentationToken({
    ...context,
    optionCount: options.length,
  });
  const payload = verifyOptionPresentationToken(presentationId, {
    userId: context.userId,
    questionId: context.questionId,
    optionCount: options.length,
    scope: context.scope,
    assessmentId: context.assessmentId,
  });
  if (!payload) {
    throw new Error("Failed to create option presentation token.");
  }

  const order = getOptionDisplayOrder(payload);
  return {
    options: order.map((index) => options[index]),
    presentationId,
  };
}
