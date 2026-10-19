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

// ---------------------------------------------------------------------------
// Numeric dd/mm/yyyy forms (Origin NOW and anything new): dates always read
// day/month/year, times always in IST and labelled as such.

/** "17/10/2026" — the IST calendar day of an instant. */
export function formatISTDayDMY(value: Date | string | number): string {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', { timeZone: IST, day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** "17/10/2026, 4:30 pm IST". */
export function formatISTDateTimeDMY(value: Date | string | number): string {
  const d = toDate(value);
  if (!d) return '—';
  const text = d.toLocaleString('en-GB', {
    timeZone: IST,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${text} IST`;
}

/** "2026-10-17" (a calendar-day key, no time zone) → "17/10/2026". */
export function dayKeyToDMY(dayKey: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : dayKey;
}

/** True for a real calendar day "YYYY-MM-DD" (Date.parse would roll "2026-02-30" into March). */
export function isDayKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const d = new Date(`${key}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === key;
}

/** "17/10/2026" → "2026-10-17", or null if it is not a real calendar date. */
export function dmyToDayKey(text: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const key = `${m[3]}-${m[2]}-${m[1]}`;
  return isDayKey(key) ? key : null;
}

/** Short weekday names, 0 = Sunday. */
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** An "HH:MM" wall-clock time (already IST) as "6:00 pm". */
export function formatClock12(hhmm: string | null | undefined): string {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}
