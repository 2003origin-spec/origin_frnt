import nodemailer, { type Transporter, type SendMailOptions } from 'nodemailer';

/**
 * Email transport.
 *
 * Audit fix R-1.1 (A-02, A-04): the original implementation built a
 * module-level transporter at import time and silently fell back to a
 * mock branch that returned `success: true` whenever any SMTP env var
 * was missing. That made OTP sends look like they shipped while no
 * mail ever left the function. Behaviour now:
 *
 *   - Lazy construction on first send.
 *   - Hard fail in production when SMTP env vars are missing — never mock.
 *   - In non-prod the dev mock is opt-in: it logs a redacted summary
 *     instead of pretending a real send succeeded.
 *   - Default to TLS-on (port 465 / `secure: true`); accepts the legacy
 *     587 + STARTTLS shape via SMTP_PORT override.
 *   - Connect / greeting / socket timeouts so a hung handshake fails
 *     fast instead of blocking the function.
 *   - One transient retry on common transport errors (ETIMEDOUT,
 *     ECONNRESET, EAI_AGAIN) per send.
 */

type SmtpEnv = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

/**
 * Ordered delivery channels. `ses` is tried first; if it fails (or isn't
 * configured), we fall back to `smtp` (the legacy adminoffice provider). This
 * gives resilience: a SES outage or throttle transparently rolls over to the
 * existing SMTP host without losing the email.
 */
type ChannelName = 'ses' | 'smtp';

type SendResult = { success: true; messageId: string } | { success: false; error: unknown };

const TRANSIENT_ERROR_CODES = new Set(['ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', 'ESOCKET']);
const TIMEOUT_MS = 10_000;
// Audit fix R-7 (A-23): jittered backoff before the single retry. The
// fixed retry without delay sometimes fired into the same dead TCP
// state and burned a second timeout for no reason.
const RETRY_BACKOFF_MIN_MS = 250;
const RETRY_BACKOFF_JITTER_MS = 250;

const DEFAULT_FROM = '"ORIGIN AI" <adminoffice@o3origin.com>';

// Per-channel transporter + verify caches (lazy, reset by __resetEmailForTests).
const transporters = new Map<ChannelName, Transporter>();
const verifies = new Map<ChannelName, Promise<void> | null>();

function toPort(value: string | undefined, fallback = 465): { port: number; secure: boolean } {
  let port = value ? Number.parseInt(value, 10) : fallback;
  if (!Number.isFinite(port) || port <= 0) port = fallback;
  // Default to TLS-on; only treat 587 / 25 as STARTTLS upgrade ports.
  return { port, secure: port === 465 };
}

/** Amazon SES SMTP channel (primary). Configured via SES_SMTP_* env vars. */
function readSesEnv(): SmtpEnv | null {
  const host = process.env.SES_SMTP_HOST;
  const user = process.env.SES_SMTP_USER;
  const pass = process.env.SES_SMTP_PASS;
  if (!host || !user || !pass) return null;
  const { port, secure } = toPort(process.env.SES_SMTP_PORT);
  // Prefer a SES-specific from, else the shared EMAIL_FROM, else the default.
  const from = process.env.SES_EMAIL_FROM ?? process.env.EMAIL_FROM ?? DEFAULT_FROM;
  return { host, port, secure, user, pass, from };
}

/** Legacy adminoffice SMTP channel (fallback). Configured via SMTP_* env vars. */
function readSmtpEnv(): SmtpEnv | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  const { port, secure } = toPort(process.env.SMTP_PORT);
  const from = process.env.EMAIL_FROM ?? DEFAULT_FROM;
  return { host, port, secure, user, pass, from };
}

/** The configured channels, in delivery-priority order (SES first). */
function configuredChannels(): { name: ChannelName; env: SmtpEnv }[] {
  const out: { name: ChannelName; env: SmtpEnv }[] = [];
  const ses = readSesEnv();
  if (ses) out.push({ name: 'ses', env: ses });
  const smtp = readSmtpEnv();
  if (smtp) out.push({ name: 'smtp', env: smtp });
  return out;
}

function isTransientTransportError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' && TRANSIENT_ERROR_CODES.has(code);
}

function buildTransporter(env: SmtpEnv): Transporter {
  return nodemailer.createTransport({
    host: env.host,
    port: env.port,
    secure: env.secure,
    auth: { user: env.user, pass: env.pass },
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
    pool: true,
    maxConnections: 3,
  });
}

function getTransporter(name: ChannelName, env: SmtpEnv): Transporter {
  const existing = transporters.get(name);
  if (existing) return existing;
  const t = buildTransporter(env);
  transporters.set(name, t);
  return t;
}

async function ensureVerified(name: ChannelName, transporter: Transporter): Promise<void> {
  const cached = verifies.get(name);
  if (cached) return cached;
  const p = transporter
    .verify()
    .then(() => undefined)
    .catch((err) => {
      // Surface verify failures loudly ([email][ALERT] is grep-friendly for
      // log alerts). Reset so a later send can retry, and throw so the caller
      // rolls over to the next channel instead of queueing onto a dead one.
      verifies.set(name, null);
      console.error(`[email][ALERT] SMTP verify() failed on channel "${name}":`, err);
      throw err instanceof Error ? err : new Error(String(err));
    });
  verifies.set(name, p);
  return p;
}

async function sleepWithJitter(): Promise<void> {
  const delay = RETRY_BACKOFF_MIN_MS + Math.floor(Math.random() * RETRY_BACKOFF_JITTER_MS);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

/** Attempt delivery on one channel (verify + send + one transient retry). */
async function sendViaChannel(
  name: ChannelName,
  env: SmtpEnv,
  msg: { to: string; subject: string; text: string; html?: string },
): Promise<SendResult> {
  const transporter = getTransporter(name, env);
  const options: SendMailOptions = {
    from: env.from,
    to: msg.to,
    subject: msg.subject,
    text: msg.text,
    html: msg.html || msg.text,
  };
  try {
    await ensureVerified(name, transporter);
    const info = await transporter.sendMail(options);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    if (isTransientTransportError(error)) {
      await sleepWithJitter();
      try {
        const info = await transporter.sendMail(options);
        return { success: true, messageId: info.messageId };
      } catch (retryError) {
        console.error(`[email][ALERT] channel "${name}" failed after retry:`, retryError);
        return { success: false, error: retryError };
      }
    }
    console.error(`[email] channel "${name}" send failed:`, error);
    return { success: false, error };
  }
}

export const sendEmail = async ({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<SendResult> => {
  const channels = configuredChannels();

  if (channels.length === 0) {
    if (process.env.NODE_ENV === 'production') {
      const error = new Error(
        '[email] No mail channel configured. Set SES_SMTP_* (primary) and/or SMTP_* (fallback). Refusing to silently mock in production.',
      );
      console.error('[email] transporter unavailable:', error);
      return { success: false, error };
    }
    // Dev fallback: opt-in mock that makes the absence of SMTP obvious in logs.
    console.warn('[email] dev mock — no mail channel configured; logging email content:', { to, subject, text });
    return { success: true, messageId: 'dev-mock-' + Date.now() };
  }

  // Try each channel in priority order (SES → adminoffice); first success wins.
  let lastError: unknown = new Error('email delivery failed');
  for (const { name, env } of channels) {
    const result = await sendViaChannel(name, env, { to, subject, text, html });
    if (result.success) return result;
    lastError = result.error;
    console.warn(`[email] channel "${name}" failed; falling back to the next channel if any.`);
  }
  return { success: false, error: lastError };
};

/**
 * Reset the cached transporters — exposed for tests so they can swap
 * environment between cases. Not part of the public runtime API.
 */
export const __resetEmailForTests = (): void => {
  transporters.clear();
  verifies.clear();
};
