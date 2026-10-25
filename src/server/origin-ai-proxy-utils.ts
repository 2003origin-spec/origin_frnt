/**
 * Pure helpers for the Ori (origin-ai) proxy route. No DB, no env, no Next
 * imports, so the stream-usage and error-mapping logic is unit-testable
 * without booting the route handler (bug-fix doc 12, findings 4 and 5).
 */

/** The message the in-app quota check already returns; keep the two in sync. */
export const DAILY_AI_LIMIT_MESSAGE =
  "You've reached your daily AI usage limit (200k tokens). Please try again tomorrow.";

export const ORI_TIMEOUT_MESSAGE = "Ori timed out, please retry.";

/** Walk an SSE buffer backwards and return the last `type: "final"` frame. */
export function extractSseFinalPayload(buffer: string): unknown | null {
  const events = buffer.split("\n\n");
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]?.trim();
    if (!event) continue;
    for (const line of event.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as { type?: string };
        if (parsed?.type === "final") {
          return parsed;
        }
      } catch {
        // Ignore malformed intermediate frames; usage is best-effort.
      }
    }
  }
  return null;
}

export interface UsageRecordingStreamOptions {
  /** Called at most once, with the `final` frame, when the stream ends by any path. */
  onFinal: (finalPayload: unknown) => Promise<void> | void;
  /** Called exactly once when the stream settles (flush or cancel), before onFinal. */
  onSettle?: () => void;
}

/**
 * Pass-through transform that buffers the SSE text and records usage from
 * the `final` frame on BOTH `flush()` (upstream closed normally) and
 * `cancel()` (the client disconnected). Before this, a client that aborted
 * right after the last text delta — once Gemini had already been billed and
 * the Python side had persisted the answer — was never charged, because
 * `flush` only runs on a clean close.
 */
export function createUsageRecordingTransform(
  options: UsageRecordingStreamOptions,
): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  let sseBuffer = "";
  let settled = false;

  const settle = async (): Promise<void> => {
    if (settled) return;
    settled = true;
    options.onSettle?.();
    sseBuffer += decoder.decode();
    const finalPayload = extractSseFinalPayload(sseBuffer);
    if (finalPayload) {
      await options.onFinal(finalPayload);
    }
  };

  // `cancel` is part of the Streams spec Transformer (Node >= 20 calls it when
  // the readable side is cancelled) but this TS DOM lib does not declare it yet.
  const transformer: Transformer<Uint8Array, Uint8Array> & {
    cancel: (reason?: unknown) => Promise<void>;
  } = {
    transform(chunk, controller) {
      sseBuffer += decoder.decode(chunk, { stream: true });
      controller.enqueue(chunk);
    },
    async flush() {
      await settle();
    },
    async cancel() {
      await settle();
    },
  };
  return new TransformStream<Uint8Array, Uint8Array>(transformer);
}

export type ProxyErrorKind = "timeout" | "connection" | "other";

const CONNECTION_ERROR_CODES = new Set(["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN"]);

function errorCode(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const direct = (err as { code?: unknown }).code;
  if (typeof direct === "string") return direct;
  const cause = (err as { cause?: unknown }).cause;
  if (cause && typeof cause === "object") {
    const nested = (cause as { code?: unknown }).code;
    if (typeof nested === "string") return nested;
  }
  return null;
}

/**
 * Only a connection-level failure (nothing is listening / DNS cannot resolve)
 * means "service down". A timeout means the Python side is still working —
 * and has usually already generated, billed and persisted the answer — so it
 * must surface as an error, never as a silent fallback to a different reply.
 */
export function classifyProxyError(err: unknown): ProxyErrorKind {
  if (err instanceof Error && err.name === "AbortError") {
    return "timeout";
  }
  const code = errorCode(err);
  if (code && CONNECTION_ERROR_CODES.has(code)) {
    return "connection";
  }
  return "other";
}

function jsonResponse(payload: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** 504 for an upstream timeout: the generation may have completed; retry, don't fabricate. */
export function proxyTimeoutResponse(requestId: string): Response {
  return jsonResponse({ detail: ORI_TIMEOUT_MESSAGE, requestId }, 504);
}

/** 502 for a non-connection transport failure (TLS, reset mid-body, ...). */
export function proxyFailureResponse(requestId: string): Response {
  return jsonResponse({ detail: "Ori could not complete this request. Please retry.", requestId }, 502);
}

/** The Python service's server-side daily budget refusal (HTTP 429). */
export function isUpstreamDailyBudgetRefusal(status: number, data: unknown): boolean {
  if (status !== 429) return false;
  if (!data || typeof data !== "object") return false;
  const detail = (data as { detail?: unknown }).detail;
  return typeof detail === "string" && /daily ai budget/i.test(detail);
}

/** Map the Python 429 onto the shape the client already handles for the in-app quota. */
export function dailyBudgetRefusalResponse(): Response {
  return jsonResponse({ detail: DAILY_AI_LIMIT_MESSAGE }, 403);
}
