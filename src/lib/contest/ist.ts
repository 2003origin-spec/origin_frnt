/**
 * IST (Asia/Kolkata, fixed UTC+05:30, no DST) time helpers for the contest
 * admin builder. Contests are scheduled and displayed in IST everywhere; the DB
 * stores UTC (TIMESTAMPTZ). These convert between a browser `datetime-local`
 * value (a wall-clock string with NO timezone) interpreted as IST and the UTC
 * ISO strings the API/DB use.
 *
 * IST has no daylight saving, so the offset is a constant +330 minutes — the
 * conversions are exact and testable without a tz database.
 */

const IST_OFFSET_MIN = 330; // +05:30

/** Human display of a UTC ISO instant in IST, e.g. "Sat, 30 Aug 2026, 1:30 PM IST". */
export function formatIST(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const s = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  return `${s} IST`;
}

/** Short IST display without the weekday, e.g. "30 Aug 2026, 1:30 PM IST". */
export function formatISTShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const s = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  return `${s} IST`;
}

/**
 * Interpret a `datetime-local` value ("YYYY-MM-DDTHH:mm") as an IST wall-clock
 * time and return the corresponding UTC ISO string. Returns null for a blank or
 * malformed value.
 */
export function istLocalToUtcIso(localValue: string | null | undefined): string | null {
  if (!localValue) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(localValue);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as unknown as number[];
  // Wall time in IST → UTC epoch by subtracting the fixed offset.
  const utcMs = Date.UTC(y, mo - 1, d, h, mi) - IST_OFFSET_MIN * 60_000;
  const dt = new Date(utcMs);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

/**
 * Convert a UTC ISO instant to the `datetime-local` value ("YYYY-MM-DDTHH:mm")
 * for its IST wall-clock time — used to prefill a date-time input when editing.
 */
export function utcIsoToIstLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  // Shift the epoch by +IST so the UTC-getters read the IST wall clock.
  const shifted = new Date(t + IST_OFFSET_MIN * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}` +
    `T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`
  );
}
