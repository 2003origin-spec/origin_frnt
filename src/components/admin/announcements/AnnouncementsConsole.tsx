'use client';

/**
 * /admin/announcements — write an announcement, pick who gets it, check the
 * reach, send a test to yourself, then send (after a confirmation that shows
 * the student count). Below: every announcement sent so far.
 * Data: /api/admin/announcements/* (admin role checked there).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import {
  ALL_STUDENTS,
  ANNOUNCEMENT_BODY_MAX,
  ANNOUNCEMENT_CLASSES,
  ANNOUNCEMENT_DEFAULT_LINK,
  ANNOUNCEMENT_EXAMS,
  ANNOUNCEMENT_QUICK_LINKS,
  ANNOUNCEMENT_TITLE_MAX,
  charCount,
  classLabel,
  describeAudience,
  examLabel,
  validateAnnouncementDraft,
  type AnnouncementAudience,
  type AnnouncementClass,
  type AnnouncementExam,
} from '@/lib/announcements';
import { mutateJson } from '@/lib/csrf';
import { formatISTDateTimeDMY } from '@/lib/format-time';

import { ErrorLine, Section, Table, Td, buttonClass, ghostButtonClass, inputClass } from '../now/ui';

const API = '/api/admin/announcements';

type Reach = { students: number; withPush: number };
type Announcement = {
  id: string;
  title: string;
  body: string;
  link: string;
  audienceLabel: string;
  test: boolean;
  sentBy: { id: string; name: string } | null;
  createdAt: string;
  finishedAt: string | null;
  recipients: number;
  pushAttempted: number;
  pushDelivered: number;
};
type StudentsAudience = Extract<AnnouncementAudience, { kind: 'students' }>;

async function readError(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return (body as { detail?: string }).detail ?? `Request failed (${res.status})`;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await mutateJson(`${API}${path}`, { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as T;
}

const students = (n: number) => `${n.toLocaleString('en-IN')} ${n === 1 ? 'student' : 'students'}`;

function reachText(reach: Reach): string {
  const phones = reach.withPush === 1 ? '1 will get a phone notification' : `${reach.withPush.toLocaleString('en-IN')} will get a phone notification`;
  return `${students(reach.students)} · ${phones}`;
}

function Counter({ used, max }: { used: number; max: number }) {
  return (
    <span className={`text-xs tabular-nums ${used > max ? 'font-semibold text-red-600' : 'text-muted-foreground'}`}>
      {used}/{max}
    </span>
  );
}

const PUSH_OFF_NOTE =
  "Phone notifications aren't set up on this server (FCM settings are missing), so only the in-app notification will go out.";

/** Roughly how it shows on a phone and in the notification list. */
function NotificationPreview({ title, body, link }: { title: string; body: string; link: string }) {
  const quick = ANNOUNCEMENT_QUICK_LINKS.find((q) => q.path === link);
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-2xl border bg-muted/40 p-3 shadow-sm">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500 text-[10px] font-black text-zinc-950">O</span>
          <span>O3 Origin</span>
          <span>·</span>
          <span>now</span>
        </div>
        <p className="mt-1.5 break-words text-sm font-semibold">{title || 'Your title'}</p>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-muted-foreground">{body || 'Your announcement text.'}</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Tapping it opens <code className="rounded bg-muted px-1">{link || ANNOUNCEMENT_DEFAULT_LINK}</code>
        {quick
          ? quick.app === 'screen'
            ? ' (an app screen in the app).'
            : ' (in the app this opens the website page in a browser).'
          : '.'}
      </p>
    </div>
  );
}

function History({ refreshKey }: { refreshKey: number }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ announcements: Announcement[]; total: number; pageSize: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}?page=${page}`, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error(await readError(res));
      setData(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load.');
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 20)));
  return (
    <Section title={`Sent announcements${data ? ` (${data.total})` : ''}`}>
      <ErrorLine error={error} />
      <Table head={['When', 'Sent by', 'Audience', 'Announcement', 'Recipients', 'Phone notifications']} empty={(data?.announcements.length ?? 0) === 0}>
        {(data?.announcements ?? []).map((a) => (
          <tr key={a.id}>
            <Td className="whitespace-nowrap">{formatISTDateTimeDMY(a.createdAt)}</Td>
            <Td>{a.sentBy?.name ?? '—'}</Td>
            <Td>
              {a.audienceLabel}
              {a.test && <span className="ml-1.5 rounded bg-sky-500/15 px-1.5 py-0.5 text-xs text-sky-800 dark:text-sky-200">test</span>}
            </Td>
            <Td>
              <p className="font-medium">{a.title}</p>
              <p className="max-w-md whitespace-pre-wrap break-words text-xs text-muted-foreground">{a.body}</p>
              <p className="text-xs text-muted-foreground">Opens {a.link}</p>
            </Td>
            <Td className="tabular-nums">{a.recipients.toLocaleString('en-IN')}</Td>
            <Td className="tabular-nums">
              {a.finishedAt ? `${a.pushDelivered.toLocaleString('en-IN')} delivered of ${a.pushAttempted.toLocaleString('en-IN')} tried` : 'Sending…'}
            </Td>
          </tr>
        ))}
      </Table>
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm">
          <button className={ghostButtonClass} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span>
            Page {page} of {pages}
          </span>
          <button className={ghostButtonClass} disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </Section>
  );
}

export function AnnouncementsConsole() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState(ANNOUNCEMENT_DEFAULT_LINK);
  const [audience, setAudience] = useState<StudentsAudience>(ALL_STUDENTS as StudentsAudience);
  const [reach, setReach] = useState<{ reach: Reach; pushConfigured: boolean } | null>(null);
  const [confirming, setConfirming] = useState<{ reach: Reach; pushConfigured: boolean } | null>(null);
  const [busy, setBusy] = useState<null | 'reach' | 'test' | 'send'>(null);
  const [result, setResult] = useState<Announcement | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  const checked = useMemo(() => validateAnnouncementDraft({ title, body, link }), [title, body, link]);
  const errors = checked.ok ? {} : checked.errors;
  // Show field problems only once something was typed (an empty form isn't "wrong" yet).
  const touched = title !== '' || body !== '';

  const changeAudience = (next: Partial<StudentsAudience>) => {
    setAudience((a) => ({ ...a, ...next }));
    setReach(null);
    setConfirming(null);
    setSendError(null);
  };

  const checkReach = async () => {
    setBusy('reach');
    try {
      setReach(await postJson<{ reach: Reach; pushConfigured: boolean }>('/preview', { audience }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed.');
    } finally {
      setBusy(null);
    }
  };

  const send = async (to: AnnouncementAudience) => {
    if (!checked.ok) return;
    const isTest = to.kind === 'me';
    setBusy(isTest ? 'test' : 'send');
    setSendError(null);
    try {
      const { announcement } = await postJson<{ announcement: Announcement }>('/send', { ...checked.draft, audience: to });
      setResult(announcement);
      setConfirming(null);
      setHistoryKey((k) => k + 1);
      toast.success(isTest ? 'Test sent to you.' : `Sent to ${students(announcement.recipients)}.`);
    } catch (err) {
      // Inline as well as the toast, so an older "Sent" line can't be mistaken for this attempt.
      const message = err instanceof Error ? err.message : 'Failed.';
      setSendError(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  /** Fresh count first, then ask. */
  const askToSend = async () => {
    if (!checked.ok) return;
    setBusy('reach');
    setSendError(null);
    try {
      const fresh = await postJson<{ reach: Reach; pushConfigured: boolean }>('/preview', { audience });
      setReach(fresh);
      if (fresh.reach.students === 0) {
        toast.error('No students match this audience.');
        return;
      }
      setConfirming(fresh);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed.');
    } finally {
      setBusy(null);
    }
  };

  const disabled = busy !== null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Section title="New announcement">
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="flex items-center justify-between">
                <span className="font-medium">Title</span>
                <Counter used={charCount(title.trim())} max={ANNOUNCEMENT_TITLE_MAX} />
              </span>
              <input
                className={inputClass}
                value={title}
                placeholder="Mock test this Sunday"
                onChange={(e) => setTitle(e.target.value)}
              />
              {touched && errors.title && <span className="text-xs text-red-600">{errors.title}</span>}
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="flex items-center justify-between">
                <span className="font-medium">Text</span>
                <Counter used={charCount(body.trim())} max={ANNOUNCEMENT_BODY_MAX} />
              </span>
              <textarea
                className={inputClass}
                rows={3}
                value={body}
                placeholder="A full JEE mock opens at 10 am IST. Free for everyone."
                onChange={(e) => setBody(e.target.value)}
              />
              {touched && errors.body && <span className="text-xs text-red-600">{errors.body}</span>}
            </label>

            <div className="flex flex-col gap-1 text-sm">
              <label className="font-medium" htmlFor="announcement-link">
                Opens
              </label>
              <input
                id="announcement-link"
                className={inputClass}
                value={link}
                placeholder="/dashboard"
                onChange={(e) => setLink(e.target.value)}
              />
              <div className="flex flex-wrap gap-1.5">
                {ANNOUNCEMENT_QUICK_LINKS.map((q) => (
                  <button
                    key={q.path}
                    type="button"
                    className={`rounded-full border px-2.5 py-0.5 text-xs ${link === q.path ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : ''}`}
                    title={q.app === 'screen' ? 'Opens an app screen in the app' : 'In the app, opens the website page'}
                    aria-label={`${q.label} (${q.path})`}
                    aria-pressed={link === q.path}
                    onClick={() => setLink(q.path)}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
              {errors.link && <span className="text-xs text-red-600">{errors.link}</span>}
            </div>

            <fieldset className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
              <legend className="px-1 font-medium">Who gets it</legend>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1.5">
                  Class
                  <select
                    className={inputClass}
                    value={audience.studentClass ?? ''}
                    onChange={(e) => changeAudience({ studentClass: (e.target.value || null) as AnnouncementClass | null })}
                  >
                    <option value="">Any class</option>
                    {ANNOUNCEMENT_CLASSES.map((c) => (
                      <option key={c} value={c}>
                        {classLabel(c)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1.5">
                  Exam
                  <select
                    className={inputClass}
                    value={audience.exam ?? ''}
                    onChange={(e) => changeAudience({ exam: (e.target.value || null) as AnnouncementExam | null })}
                  >
                    <option value="">Any exam</option>
                    {ANNOUNCEMENT_EXAMS.map((x) => (
                      <option key={x} value={x}>
                        {examLabel(x)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={audience.premiumOnly}
                    onChange={(e) => changeAudience({ premiumOnly: e.target.checked })}
                  />
                  Premium only
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                {describeAudience(audience)}. Only active student accounts: accounts an admin revoked or deleted are skipped. Premium means
                a paid subscription or a granted subject that is active now.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className={ghostButtonClass} disabled={disabled} onClick={checkReach}>
                  {busy === 'reach' ? 'Checking…' : 'Check reach'}
                </button>
                {reach && <span className="tabular-nums">{reachText(reach.reach)}</span>}
              </div>
              {reach && !reach.pushConfigured && <p className="text-xs text-amber-700 dark:text-amber-300">{PUSH_OFF_NOTE}</p>}
            </fieldset>

            {confirming ? (
              <div className="flex flex-col gap-2 rounded-lg border border-amber-400/60 bg-amber-500/10 p-3 text-sm">
                <p className="font-semibold">Send to {students(confirming.reach.students)}?</p>
                <p className="text-xs text-muted-foreground">
                  {describeAudience(audience)}. {confirming.pushConfigured
                    ? `${confirming.reach.withPush.toLocaleString('en-IN')} of them will also get a phone notification.`
                    : PUSH_OFF_NOTE}{' '}
                  This can&apos;t be undone.
                </p>
                <div className="flex gap-2">
                  <button type="button" className={buttonClass} disabled={disabled} onClick={() => send(audience)}>
                    {busy === 'send' ? 'Sending…' : 'Yes, send'}
                  </button>
                  <button type="button" className={ghostButtonClass} disabled={disabled} onClick={() => setConfirming(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button type="button" className={ghostButtonClass} disabled={disabled || !checked.ok} onClick={() => send({ kind: 'me' })}>
                  {busy === 'test' ? 'Sending test…' : 'Send test to me'}
                </button>
                <button type="button" className={buttonClass} disabled={disabled || !checked.ok} onClick={askToSend}>
                  Send to students…
                </button>
              </div>
            )}

            {sendError ? (
              <p className="rounded-lg border border-red-300 p-3 text-sm text-red-700 dark:text-red-400" role="alert">
                {sendError}
              </p>
            ) : (
              result && (
                <p className="rounded-lg border p-3 text-sm" role="status">
                  {result.test ? (
                    <strong>Test sent to you.</strong>
                  ) : (
                    <>
                      <strong>Sent</strong> to {students(result.recipients)}.
                    </>
                  )}{' '}
                  Phone notifications: {result.pushDelivered.toLocaleString('en-IN')} delivered of{' '}
                  {result.pushAttempted.toLocaleString('en-IN')} tried.
                </p>
              )
            )}
          </div>
        </Section>

        <Section title="Preview">
          <NotificationPreview title={title.trim()} body={body.trim()} link={link.trim()} />
        </Section>
      </div>

      <History refreshKey={historyKey} />
    </div>
  );
}
