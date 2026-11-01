import { NextResponse, type NextRequest } from "next/server";

import { authLimiter, checkRateLimit, refreshLimiter } from "@/lib/rate-limit";
import { requestPasswordResetAction, resetPasswordAction } from "@/server/actions/auth-actions";
import { sendOtpAction, verifyOtpAction } from "@/server/actions/otp-actions";
import { revokeRefreshSession } from "@/server/auth";
import { loginAccountKey, loginGate, shouldCountLoginFailure } from "@/server/auth-login-gate";
import { ACCESS_TOKEN_TTL_SECONDS } from "@/server/auth-jwt";
import { badRequest, parseJsonBody } from "@/server/http";
import { getLaunchSettings } from "@/server/launch-settings";
import { mobileTeacherEnabled } from "@/server/mobile/config";
import { deleteOtp, isEmailVerified } from "@/server/otp-store";
import { handleGoogleLogin, handleGoogleSignup, handleLogin, handleRefresh, handleRegister } from "@/server/users";

/**
 * Native-app session endpoints — `/api/mobile/auth/*` (V1/NATIVE_APP_API_PLAN.md).
 *
 * Same handlers, launch gates and rate limits as the website's Server Actions,
 * but tokens come back in the JSON body instead of HttpOnly cookies, because the
 * app keeps them in the phone's secure storage. App sessions are minted as the
 * "android" client kind (refresh lives until sign-out, AUTH_TOKEN_LIFETIME_PLAN.md).
 *
 * Browser guard: body-delivered tokens would let XSS on the website read a
 * long-lived refresh token, so every request that carries `Origin` or
 * `Sec-Fetch-Site` (sent by browsers on every fetch, unremovable by page JS,
 * absent from the native networking stack) is refused.
 */

const APP_CLIENT_KIND = "android" as const;
const LOGIN_DISABLED_MESSAGE = "Login is currently disabled. Please check back soon.";
const SIGNUP_DISABLED_MESSAGE = "New sign-ups are currently disabled. Please check back soon.";

type Body = Record<string, unknown>;

export function isBrowserRequest(request: Request): boolean {
  return Boolean(request.headers.get("origin") || request.headers.get("sec-fetch-site"));
}

function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  return xff?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "anonymous";
}

function str(body: Body, key: string): string {
  const value = body[key];
  return typeof value === "string" ? value.trim() : "";
}

function fail(status: number, detail: string, extra?: Body): NextResponse {
  return NextResponse.json({ detail, ...extra }, { status });
}

async function launchSetting(key: "allowLogin" | "allowSignup"): Promise<boolean> {
  try {
    return (await getLaunchSettings())[key];
  } catch {
    // Fail open, like the Server Actions: never lock everyone out on a settings hiccup.
    return true;
  }
}

/**
 * Turn a users-handler response (`{user, access, refresh, accessFingerprint}`)
 * into the app's token shape. Errors pass through with their status and detail.
 */
export async function toAppTokens(response: Response): Promise<NextResponse> {
  let data: Body = {};
  try {
    data = (await response.clone().json()) as Body;
  } catch {
    // fall through
  }
  if (!response.ok) {
    const detail = typeof data.detail === "string" ? data.detail : typeof data.message === "string" ? data.message : "Authentication failed.";
    if (data.needs_signup === true && typeof data.email === "string") {
      return fail(response.status, detail, { needsGoogleSignup: true, email: data.email, name: data.name });
    }
    return fail(response.status, detail);
  }
  const accessToken = typeof data.access === "string" ? data.access : "";
  const accessFingerprint = typeof data.accessFingerprint === "string" ? data.accessFingerprint : "";
  if (!accessToken || !accessFingerprint) {
    return fail(500, "Malformed auth response.");
  }
  return NextResponse.json(
    {
      ...(data.user ? { user: data.user } : {}),
      accessToken,
      accessFingerprint,
      ...(typeof data.refresh === "string" ? { refreshToken: data.refresh } : {}),
      accessTokenExpiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString(),
    },
    { status: response.status },
  );
}

type AppRole = "student" | "teacher";

/**
 * The account type the app signs in as. Only student and teacher are allowed:
 * the legacy handlers would also accept "admin" (and the same email can hold a
 * student and a teacher account), so the role is whitelisted here and never
 * passed through. Missing means student, as before teacher support.
 */
function appRole(body: Body): AppRole | null {
  const raw = body.role;
  if (raw === undefined || raw === null || raw === "" || raw === "student") return "student";
  if (raw === "teacher") return mobileTeacherEnabled() ? "teacher" : null;
  return null;
}

const ROLE_REFUSED = "Choose Student or Teacher.";

async function login(body: Body): Promise<Response> {
  if (!(await launchSetting("allowLogin"))) return fail(403, LOGIN_DISABLED_MESSAGE);
  const role = appRole(body);
  if (!role) return badRequest(ROLE_REFUSED);
  return toAppTokens(await handleLogin({ email: str(body, "email"), password: body.password, role, clientKind: APP_CLIENT_KIND }));
}

async function google(body: Body): Promise<Response> {
  if (!(await launchSetting("allowLogin"))) return fail(403, LOGIN_DISABLED_MESSAGE);
  const role = appRole(body);
  if (!role) return badRequest(ROLE_REFUSED);
  return toAppTokens(await handleGoogleLogin({ credential: str(body, "credential"), role, clientKind: APP_CLIENT_KIND }));
}

async function googleSignup(body: Body): Promise<Response> {
  if (!(await launchSetting("allowSignup"))) return fail(403, SIGNUP_DISABLED_MESSAGE);
  const role = appRole(body);
  if (!role) return badRequest(ROLE_REFUSED);
  return toAppTokens(
    await handleGoogleSignup({
      credential: str(body, "credential"),
      role,
      mobile: str(body, "mobile"),
      location: str(body, "state"),
      clientKind: APP_CLIENT_KIND,
    }),
  );
}

async function refresh(body: Body): Promise<Response> {
  const refreshToken = str(body, "refreshToken");
  if (!refreshToken) return badRequest("refreshToken is required.");
  // No Request is passed: the token comes only from the body, never a cookie.
  return toAppTokens(await handleRefresh(null, { refresh: refreshToken }));
}

async function logout(body: Body): Promise<Response> {
  await revokeRefreshSession(str(body, "refreshToken") || null);
  return NextResponse.json({ ok: true });
}

async function otpSend(body: Body): Promise<Response> {
  const role = appRole(body);
  if (!role) return badRequest(ROLE_REFUSED);
  const result = await sendOtpAction(str(body, "email"), role);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

async function otpVerify(body: Body): Promise<Response> {
  const result = await verifyOtpAction(str(body, "email"), str(body, "code"));
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

async function register(body: Body): Promise<Response> {
  if (!(await launchSetting("allowSignup"))) return fail(403, SIGNUP_DISABLED_MESSAGE);
  const role = appRole(body);
  if (!role) return badRequest(ROLE_REFUSED);
  const email = str(body, "email");
  if (!(await isEmailVerified(email))) {
    return fail(400, "Email verification required. Please verify your email first.");
  }
  const response = await toAppTokens(
    await handleRegister({
      name: str(body, "name"),
      email,
      password: body.password,
      mobile: str(body, "mobile"),
      location: str(body, "state"),
      role,
      clientKind: APP_CLIENT_KIND,
    }),
  );
  if (response.ok) await deleteOtp(email).catch(() => {});
  return response;
}

async function passwordRequest(body: Body): Promise<Response> {
  // Enforced inside the action: per-IP + per-email caps, always { ok: true }.
  const role = appRole(body);
  if (!role) return badRequest(ROLE_REFUSED);
  const { ok } = await requestPasswordResetAction({ email: str(body, "email"), role });
  return NextResponse.json({ ok });
}

async function passwordReset(body: Body): Promise<Response> {
  const role = appRole(body);
  if (!role) return badRequest(ROLE_REFUSED);
  const result = await resetPasswordAction({
    email: str(body, "email"),
    role,
    code: str(body, "code"),
    newPassword: typeof body.newPassword === "string" ? body.newPassword : "",
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

const routes: Record<string, (body: Body) => Promise<Response>> = {
  login,
  google,
  "google/signup": googleSignup,
  refresh,
  logout,
  "otp/send": otpSend,
  "otp/verify": otpVerify,
  register,
  "password/request": passwordRequest,
  "password/reset": passwordReset,
};

/** Dispatch POST /api/mobile/auth/<path>. `path` is the slug after "auth". */
export async function handleAppAuth(request: NextRequest, path: string[]): Promise<Response> {
  if (isBrowserRequest(request)) {
    return fail(403, "This endpoint is only for the Origin app.");
  }
  const key = path.join("/");
  const handler = routes[key];
  if (!handler) return fail(404, "Not found.");

  const ip = clientIp(request);
  if (key === "refresh") {
    const limited = await checkRateLimit(refreshLimiter, `ip:${ip}`, { honorIncidentMode: false });
    if (limited) return limited;
  } else if (key === "google/signup" || key === "register") {
    // Account creation. Sign-in (login, google) goes through loginGate below
    // instead: a strict per-IP cap there locks out a whole school on one IP.
    const limited = await checkRateLimit(authLimiter, `app:${ip}`);
    if (limited) return limited;
  }

  let body: Body = {};
  try {
    body = await parseJsonBody<Body>(request);
  } catch {
    return badRequest("Invalid JSON body.");
  }

  // The website's login lockouts (per-IP + per-account, checked BEFORE the
  // password; bug-fix spec 01-auth.md). Same gate as loginAction and the REST
  // /api/users/login route, so the app is no side door for password guessing.
  const isPasswordLogin = key === "login";
  const accountKey = isPasswordLogin ? loginAccountKey(body.email) : "";
  if (isPasswordLogin || key === "google" || key === "google/signup") {
    const gated = isPasswordLogin
      ? await loginGate.gate(ip, accountKey)
      : await loginGate.gate(ip, `google:${ip}`, "google");
    if (gated) return fail(gated.status, gated.message);
  }

  try {
    const response = await handler(body);
    if (isPasswordLogin && shouldCountLoginFailure({ ok: response.ok, status: response.status })) {
      await loginGate.recordFailure(ip, accountKey);
    }
    return response;
  } catch (error) {
    console.error(`[mobile-auth] ${key} failed:`, error instanceof Error ? error.message : error);
    return fail(503, "Sign-in is temporarily unavailable. Please try again in a moment.");
  }
}
