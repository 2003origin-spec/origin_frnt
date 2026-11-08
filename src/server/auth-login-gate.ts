import {
  isLockedOut,
  isWithinLimit,
  loginAccountFailureLimiter,
  loginFailureLimiter,
  loginIpFailureLimiter,
  loginIpLimiter,
  resetLimit,
  type AppRateLimiter,
} from "@/lib/rate-limit";

/**
 * Brute-force gate for every login path (BUG_FIX_PLAN.md A2): the Server
 * Actions (which skip middleware) and REST `POST /api/users/login`.
 *
 * Layers (see the limiter definitions in `@/lib/rate-limit`):
 *   1. per-IP throughput, consumed on every attempt (loose: NAT/CGNAT);
 *   2. per-IP failures across all accounts — a loose backstop (200 / 10 min)
 *      so one bad actor behind a school NAT cannot lock the school out. Each
 *      method counts on its own IP key (password vs OTP);
 *   3. per account + client IP prefix failures — the real brute-force guard;
 *   4. per account failures from anywhere — a looser backstop.
 * Layers 2-4 are read (not consumed) before the attempt, so a locked caller is
 * refused without touching the password hash, and bumped only on failure.
 * Google sign-in uses layer 1 only: the ID token is signature- and audience-
 * verified, so a rejected one is not a guess and must not spend anyone's
 * failure budget.
 * Keying layer 3 on the IP prefix means a stranger who knows a student's email
 * cannot lock that student out from another network. All limiters fail
 * closed: an Upstash outage denies logins rather than opening an unthrottled
 * guessing surface (refresh keeps existing sessions alive).
 */

export type LoginGateFailure = { ok: false; status: 429; message: string };

export const LOGIN_IP_LIMITED_MESSAGE = "Too many login attempts. Please wait a few minutes and try again.";
export const LOGIN_LOCKED_MESSAGE =
  "Too many failed attempts for this account. Try again in 15 minutes or reset your password.";

/**
 * Which sign-in method is being gated. `password` (default) and `otp` count
 * failures on separate per-IP keys (and separate account keys, see
 * `loginAccountKey` / `otpLoginKey`); `google` counts no failures at all.
 */
export type LoginMethod = "password" | "otp" | "google";

export type LoginGate = {
  /** Call BEFORE the credential check. Returns a 429 failure or null to proceed. */
  gate(ip: string, accountKey: string, method?: LoginMethod): Promise<LoginGateFailure | null>;
  /** Call after a FAILED attempt (not on 5xx — see `shouldCountLoginFailure`). No-op for `google`. */
  recordFailure(ip: string, accountKey: string, method?: LoginMethod): Promise<void>;
  /** Forget the account's failures (after a successful password reset proves inbox control). */
  clearAccount(ip: string, accountKey: string): Promise<void>;
};

export type LoginGateDeps = {
  ipLimiter: AppRateLimiter;
  ipFailureLimiter: AppRateLimiter;
  failureLimiter: AppRateLimiter;
  accountFailureLimiter: AppRateLimiter;
};

/**
 * Network prefix used to scope per-account failures: /24 for IPv4 (and
 * IPv4-mapped IPv6), /48 for IPv6. Anything unparseable is used as-is.
 */
export function ipPrefix(ip: string): string {
  const raw = ip.trim().toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(raw);
  const v4 = mapped ? mapped[1] : raw;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(v4)) {
    return `${v4.split(".").slice(0, 3).join(".")}.0/24`;
  }
  if (raw.includes(":")) {
    let groups: string[];
    if (raw.includes("::")) {
      const [head, tail] = raw.split("::");
      const headParts = head ? head.split(":") : [];
      const tailParts = tail ? tail.split(":") : [];
      const fill = Math.max(0, 8 - headParts.length - tailParts.length);
      groups = [...headParts, ...Array<string>(fill).fill("0"), ...tailParts];
    } else {
      groups = raw.split(":");
    }
    const first3 = groups.slice(0, 3).map((g) => (Number.parseInt(g, 16) || 0).toString(16));
    return `${first3.join(":")}::/48`;
  }
  return raw || "unknown";
}

export function createLoginGate(deps: LoginGateDeps): LoginGate {
  const scoped = (ip: string, accountKey: string) => `${accountKey}|${ipPrefix(ip)}`;
  // Password keeps the original `ip:` key so existing counters carry over.
  const ipFailureKey = (ip: string, method: LoginMethod) => (method === "otp" ? `otp-ip:${ip}` : `ip:${ip}`);
  return {
    async gate(ip, accountKey, method = "password") {
      if (!(await isWithinLimit(deps.ipLimiter, `ip:${ip}`))) {
        return { ok: false, status: 429, message: LOGIN_IP_LIMITED_MESSAGE };
      }
      if (method === "google") return null;
      if (await isLockedOut(deps.ipFailureLimiter, ipFailureKey(ip, method))) {
        return { ok: false, status: 429, message: LOGIN_IP_LIMITED_MESSAGE };
      }
      if (
        (await isLockedOut(deps.failureLimiter, scoped(ip, accountKey))) ||
        (await isLockedOut(deps.accountFailureLimiter, accountKey))
      ) {
        return { ok: false, status: 429, message: LOGIN_LOCKED_MESSAGE };
      }
      return null;
    },
    async recordFailure(ip, accountKey, method = "password") {
      if (method === "google") return;
      // The results are irrelevant: we only want the hits counted.
      await Promise.all([
        isWithinLimit(deps.ipFailureLimiter, ipFailureKey(ip, method)),
        isWithinLimit(deps.failureLimiter, scoped(ip, accountKey)),
        isWithinLimit(deps.accountFailureLimiter, accountKey),
      ]);
    },
    async clearAccount(ip, accountKey) {
      // Counters scoped to OTHER prefixes are left alone: they only ever lock
      // out those networks, never the account owner's.
      await Promise.all([
        resetLimit(deps.failureLimiter, scoped(ip, accountKey)),
        resetLimit(deps.accountFailureLimiter, accountKey),
      ]);
    },
  };
}

/**
 * A failed attempt counts toward the lockout unless it was OUR failure (5xx:
 * DB down, malformed response) — those must never lock a real user out. The
 * "needs Google signup" response is not a credential failure either.
 */
export function shouldCountLoginFailure(result: { ok: boolean; status: number; needsGoogleSignup?: boolean }): boolean {
  if (result.ok) return false;
  if (result.needsGoogleSignup) return false;
  return result.status < 500;
}

function normalizedEmail(email: unknown): string {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

/**
 * Password-lockout key: the email alone. The role is deliberately NOT part of
 * it — Server Actions do not type-check at runtime, and `handleLogin` maps any
 * unknown role to "try student and teacher", so a role in the key handed every
 * junk/case variant a fresh budget against the same password hash.
 */
export function loginAccountKey(email: unknown): string {
  return `pw:${normalizedEmail(email)}`;
}

/**
 * OTP-login key. Separate from the password budget: the emailed code is the
 * secret there (guarded by `otpVerifyEmailLimiter`), and sharing the password
 * counter let a stranger's wrong passwords block the owner's OTP sign-in too.
 */
export function otpLoginKey(email: unknown): string {
  return `otp:${normalizedEmail(email)}`;
}

export const loginGate: LoginGate = createLoginGate({
  ipLimiter: loginIpLimiter,
  ipFailureLimiter: loginIpFailureLimiter,
  failureLimiter: loginFailureLimiter,
  accountFailureLimiter: loginAccountFailureLimiter,
});
