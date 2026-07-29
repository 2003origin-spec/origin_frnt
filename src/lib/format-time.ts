/**
 * India-Standard-Time formatters for user-facing wall-clock displays.
 *
 * Origin is an India-only product (JEE / NEET / TBJEE), so every absolute
 * date/time shown to a user must read in IST regardless of where the code runs.
 * Plain `toLocaleTimeString()` uses the *device/runtime* zone — which is UTC
 * during Next.js SSR (Vercel runs in UTC) and on some emulators, producing the
 * "GMT / 5½-hours-off" times the team reported. Pinning `timeZone` fixes that.
 *
 * NOTE: use these ONLY for absolute timestamps. Durations (elapsed seconds) and
 * `datetime-local` input values are timezone-independent and must NOT go through
 * these helpers.
 */

const IST = 'Asia/Kolkata';

function toDate(value: Date | string | number): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "4:30 PM" in IST. */
export function formatISTTime(value: Date | string | number): string {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleTimeString('en-IN', { timeZone: IST, hour: '2-digit', minute: '2-digit' });
}

/** "29 Jul 2026, 4:30 PM" in IST. */
export function formatISTDateTime(value: Date | string | number): string {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleString('en-IN', {
    timeZone: IST,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "29 Jul 2026" in IST. */
export function formatISTDate(value: Date | string | number): string {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('en-IN', { timeZone: IST, day: '2-digit', month: 'short', year: 'numeric' });
}
