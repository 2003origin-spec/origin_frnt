/**
 * Thin server-to-server client for contest-service (Cloud Run :8040).
 *
 * The frontend never calls contest-service from the browser — only internal
 * cron/route handlers do. Base URL + bearer mirror the grader/analytics client
 * convention. When CONTEST_SERVICE_URL is unset (local dev without the worker),
 * calls no-op so the cron tick doesn't error.
 *
 * Plan: V1/CONTEST_ORBIT_IMPLEMENTATION_PLAN.md Phase 1.
 */

const DEFAULT_TIMEOUT_MS = 30_000;

export function isContestServiceConfigured(): boolean {
  return Boolean(process.env.CONTEST_SERVICE_URL);
}

interface JobResult {
  ok: boolean;
  status: number;
  body: unknown;
}

async function postJob(path: string, contestId: string): Promise<JobResult> {
  const base = process.env.CONTEST_SERVICE_URL;
  if (!base) return { ok: false, status: 0, body: { skipped: "CONTEST_SERVICE_URL unset" } };
  const token = process.env.CONTEST_SERVICE_TOKEN;
  if (!token) {
    throw new Error("[contest-service-client] CONTEST_SERVICE_TOKEN must be set when CONTEST_SERVICE_URL is configured");
  }

  const controller = new AbortController();
  const timeout = Number(process.env.CONTEST_SERVICE_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ contest_id: contestId }),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

export function drainContest(contestId: string): Promise<JobResult> {
  return postJob("/v1/drain", contestId);
}

export function finalizeContest(contestId: string): Promise<JobResult> {
  return postJob("/v1/finalize", contestId);
}

export function rankContest(contestId: string): Promise<JobResult> {
  return postJob("/v1/rank", contestId);
}

export function rateContest(contestId: string): Promise<JobResult> {
  return postJob("/v1/rating", contestId);
}
