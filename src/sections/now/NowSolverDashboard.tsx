'use client';

/**
 * Solver dashboard + shift (build step 10; plan doc "Solver dashboard" and
 * gap 9). The shift panel puts the solver online for their subjects while
 * this screen is open and visible (the pilot's foreground-only rule), streams
 * offers, and plays a sound; accepting opens the live room. Below it, the
 * dashboard: summary, earnings, subjects, difficulty, feedback, activity and
 * standing. Students appear by first name only.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, Coins, Loader2, Power, Star } from 'lucide-react';

import { FormattedMessage } from '@/components/origin-ai/FormattedMessage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiCall } from '@/lib/api';
import { dayKeyToDMY } from '@/lib/format-time';

import { NowOfferAlerts } from './NowOfferAlerts';
import { NowRosterCard } from './NowRosterCard';

type Dashboard = {
  profile: { helperId: string; name: string; status: string; restrictedReason: string | null; online: boolean };
  summary: {
    solvedToday: number;
    solvedThisWeek: number;
    solvedThisMonth: number;
    solvedAllTime: number;
    resolutionRate: number | null;
    averageStars: number | null;
    acceptRate: number | null;
    medianAcceptSeconds: number | null;
  };
  bySubject: { subject: string; chapter: string | null; solved: number; resolutionRate: number | null; averageStars: number | null }[];
  byDifficulty: { difficulty: string; solved: number; acceptRate: number | null }[];
  earnings: { daily: { day: string; sessions: number; tips: number }[]; thisMonth: { sessions: number; tips: number }; balance: number; pending: number; storeSpendThisMonth: number };
  feedback: { tags: { tag: string; n: number }[]; recentComments: { comment: string; stars: number; studentFirstName: string; at: string | null }[] };
  activity: { day: string; hoursOnline: number; sessions: number }[];
  standing: { levels: { subject: string; level: string }[]; warnings: { limit: string; detail: string }[] };
  publicCard: { name: string; subjects: string[]; averageStars: number | null; sessions: number };
};

type Offer = {
  offerId: string;
  requestId: string;
  expiresAt: string;
  card: {
    subject: string;
    chapter: string | null;
    difficulty: string;
    priceCoins: number;
    language: string | null;
    aiExplained: boolean;
    question: { text: string; options: string[]; image: string | null };
  };
};

const TAG_LABEL: Record<string, string> = {
  clear_explanation: 'Clear explanation',
  fast_response: 'Quick to help',
  strong_subject_knowledge: 'Knows the subject',
  friendly: 'Friendly',
  not_resolved: 'Doubt not solved',
};
const DECLINES: { id: string; label: string }[] = [
  { id: 'not_my_topic', label: 'Not my topic' },
  { id: 'busy', label: 'Busy' },
  { id: 'too_hard', label: 'Too hard' },
  { id: 'other', label: 'Other' },
];
const HEARTBEAT_MS = 20_000;

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.2;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    // Audio may be blocked until the solver interacts with the page.
  }
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function OfferCard({ offer, onAccept, onDecline, busy }: { offer: Offer; onAccept: () => void; onDecline: (reason: string) => void; busy: boolean }) {
  const [left, setLeft] = useState(() => Math.max(0, new Date(offer.expiresAt).getTime() - Date.now()));
  useEffect(() => {
    const id = window.setInterval(() => setLeft(Math.max(0, new Date(offer.expiresAt).getTime() - Date.now())), 250);
    return () => window.clearInterval(id);
  }, [offer.expiresAt]);
  const c = offer.card;
  return (
    <Card className="border-primary">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="capitalize">New doubt · {c.subject}{c.chapter ? ` · ${c.chapter}` : ''} · {c.difficulty}</span>
          <span className={`font-mono ${left < 8000 ? 'text-red-600' : ''}`} aria-label="Seconds left">{Math.ceil(left / 1000)}s</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <div className="rounded-md bg-muted p-3"><FormattedMessage content={c.question.text} /></div>
        {c.question.options.length > 0 && (
          <ol className="grid gap-1 sm:grid-cols-2">
            {c.question.options.map((o, i) => (
              <li key={i}><strong>{String.fromCharCode(65 + i)}.</strong> <FormattedMessage content={o} inline /></li>
            ))}
          </ol>
        )}
        <p className="text-muted-foreground">
          <Coins className="mr-1 inline h-4 w-4 text-amber-600" aria-hidden />{c.priceCoins} coins
          {c.language ? ` · prefers ${c.language}` : ''}{c.aiExplained ? ' · already read the AI explanation' : ''}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onAccept} disabled={busy || left === 0}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Accept</Button>
          {DECLINES.map((d) => (
            <Button key={d.id} variant="outline" size="sm" disabled={busy} onClick={() => onDecline(d.id)}>{d.label}</Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ShiftPanel({ dashboard, onChanged }: { dashboard: Dashboard; onChanged: () => void }) {
  const router = useRouter();
  const subjects = dashboard.publicCard.subjects;
  const [chosen, setChosen] = useState<string[]>(subjects);
  const [online, setOnline] = useState(false);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);
  const timerRef = useRef<number | null>(null);
  const chosenRef = useRef(chosen);
  chosenRef.current = chosen;
  // With offer alerts on, the shift keeps running from a background tab (decision B85).
  const [alertsOn, setAlertsOn] = useState(false);
  const alertsRef = useRef(false);
  alertsRef.current = alertsOn;

  const heartbeat = useCallback(async () => {
    const background = document.hidden;
    // Pilot rule: without offer alerts, online only while this screen is in front.
    if (background && !alertsRef.current) return;
    try {
      const res = await apiCall('/now/helper/presence', { method: 'POST', body: JSON.stringify({ subjects: chosenRef.current, background }) });
      if (res.offer) setOffer(res.offer as Offer);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not stay online.');
      setOnline(false);
    }
  }, []);

  const stop = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const goOnline = async () => {
    setMessage(null);
    setOnline(true);
    await heartbeat();
    timerRef.current = window.setInterval(() => void heartbeat(), HEARTBEAT_MS);
    const source = new EventSource('/api/now/helper/stream');
    const onEvent = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'snapshot' && data.offer) setOffer(data.offer as Offer);
        if (data.type === 'offer') {
          setOffer({ offerId: data.offerId, requestId: data.requestId, expiresAt: data.expiresAt, card: data.card });
          beep();
        }
        if (data.type === 'offer_closed') setOffer((o) => (o && o.offerId === data.offerId ? null : o));
        if (data.type === 'restricted') {
          setMessage(`New offers are paused: ${data.reason ?? 'an admin will review your account.'}`);
          setOnline(false);
          stop();
        }
        if (data.type === 'rated' || data.type === 'ended') onChanged();
      } catch {
        // Ignore malformed events.
      }
    };
    for (const type of ['snapshot', 'offer', 'offer_closed', 'restricted', 'rated', 'ended', 'request_cancelled']) {
      source.addEventListener(type, onEvent as EventListener);
    }
    sourceRef.current = source;
  };

  const goOffline = async () => {
    stop();
    setOnline(false);
    setOffer(null);
    await apiCall('/now/helper/presence', { method: 'DELETE' }).catch(() => undefined);
  };

  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden && timerRef.current) void heartbeat();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      stop();
    };
  }, [heartbeat, stop]);

  const respond = async (action: 'accept' | 'decline', reason?: string) => {
    if (!offer) return;
    setBusy(true);
    try {
      const res = await apiCall(`/now/offers/${offer.offerId}`, { method: 'POST', body: JSON.stringify({ action, reason: reason ?? null }) });
      const requestId = offer.requestId;
      setOffer(null);
      if (action === 'accept' && res.accepted) {
        stop();
        router.push(`/now/room?request=${encodeURIComponent(requestId)}`);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'That offer is no longer open.');
      setOffer(null);
    } finally {
      setBusy(false);
    }
  };

  const restricted = dashboard.profile.status !== 'verified';
  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <p className="font-semibold">{online ? 'You are online' : 'You are offline'}</p>
            <p className="text-xs text-muted-foreground">
              {online
                ? alertsOn
                  ? 'Offers arrive here with a sound, and as an alert while this tab is in the background.'
                  : 'Keep this screen open and in front; offers arrive here with a sound.'
                : 'Go online to receive doubts in your subjects.'}
            </p>
            <div className="mt-2">
              <NowOfferAlerts onChange={setAlertsOn} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {subjects.map((s) => (
              <label key={s} className="flex items-center gap-1 capitalize">
                <input type="checkbox" disabled={online} checked={chosen.includes(s)} onChange={(e) => setChosen(e.target.checked ? [...chosen, s] : chosen.filter((x) => x !== s))} />
                {s}
              </label>
            ))}
            <Button onClick={online ? goOffline : goOnline} variant={online ? 'outline' : 'default'} disabled={restricted || (!online && chosen.length === 0)}>
              <Power className="mr-2 h-4 w-4" /> {online ? 'Go offline' : 'Go online'}
            </Button>
          </div>
        </CardContent>
      </Card>
      {restricted && (
        <p className="flex items-center gap-2 rounded-md border border-amber-500 bg-amber-500/10 p-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4" /> New offers are paused{dashboard.profile.restrictedReason ? `: ${dashboard.profile.restrictedReason}` : ''}. An admin will review your account.
        </p>
      )}
      {message && <p className="text-sm text-muted-foreground" role="status">{message}</p>}
      {offer && <OfferCard offer={offer} busy={busy} onAccept={() => respond('accept')} onDecline={(r) => respond('decline', r)} />}
    </div>
  );
}

export default function NowSolverDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const res = await apiCall('/now/solver/dashboard');
      setData(res.dashboard as Dashboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your dashboard.');
    }
  }, []);
  useEffect(() => {
    let cancelled = false;
    apiCall('/now/solver/dashboard')
      .then((res) => !cancelled && setData(res.dashboard as Dashboard))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Could not load your dashboard.'));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) {
    return error ? (
      <p className="p-6 text-sm text-muted-foreground">{error}</p>
    ) : (
      <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" /></div>
    );
  }
  const s = data.summary;
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Hi {data.profile.name}</h1>
          <p className="text-sm text-muted-foreground">Your Origin NOW shift and how your sessions are going.</p>
        </div>
        <span className="flex items-center gap-2 text-sm">
          <Coins className="h-4 w-4 text-amber-600" aria-hidden /> {data.earnings.balance} spendable · {data.earnings.pending} pending
        </span>
      </header>

      <ShiftPanel dashboard={data} onChanged={load} />

      <NowRosterCard />

      {data.standing.warnings.map((w) => (
        <p key={w.limit} className="flex items-center gap-2 rounded-md border border-amber-500 bg-amber-500/10 p-2 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4" /> {w.detail}
        </p>
      ))}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Solved today" value={s.solvedToday} />
        <Stat label="This week / month" value={`${s.solvedThisWeek} / ${s.solvedThisMonth}`} />
        <Stat label="All time" value={s.solvedAllTime} />
        <Stat label="Solved fully" value={pct(s.resolutionRate)} />
        <Stat label="Average rating" value={s.averageStars === null ? '—' : `${s.averageStars.toFixed(1)}★`} />
        <Stat label="Accept rate" value={pct(s.acceptRate)} />
        <Stat label="Median time to accept" value={s.medianAcceptSeconds === null ? '—' : `${s.medianAcceptSeconds}s`} />
        <Stat label="Coins this month" value={`${data.earnings.thisMonth.sessions + data.earnings.thisMonth.tips}`} />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Coins earned, last 30 days</CardTitle></CardHeader>
        <CardContent>
          {data.earnings.daily.length === 0 ? (
            <p className="text-sm text-muted-foreground">No coins yet. Earnings wait 24 hours (the rating window) before you can spend them.</p>
          ) : (
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.earnings.daily}>
                  <XAxis dataKey="day" tickFormatter={(d: string) => dayKeyToDMY(d).slice(0, 5)} fontSize={11} />
                  <YAxis fontSize={11} width={36} />
                  <Tooltip labelFormatter={(d) => dayKeyToDMY(String(d))} />
                  <Bar dataKey="sessions" stackId="a" name="Sessions" fill="hsl(var(--primary))" />
                  <Bar dataKey="tips" stackId="a" name="Tips" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">This month: {data.earnings.thisMonth.sessions} from sessions, {data.earnings.thisMonth.tips} in tips, {data.earnings.storeSpendThisMonth} spent in the store.</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Where you are strong</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">Subject · chapter</th><th>Solved</th><th>Fully</th><th>Rating</th></tr></thead>
              <tbody>
                {data.bySubject.map((b, i) => (
                  <tr key={i} className="border-t"><td className="py-1 capitalize">{b.subject} · {b.chapter ?? '—'}</td><td>{b.solved}</td><td>{pct(b.resolutionRate)}</td><td>{b.averageStars === null ? '—' : b.averageStars.toFixed(1)}</td></tr>
                ))}
              </tbody>
            </table>
            {data.bySubject.length === 0 && <p className="text-sm text-muted-foreground">Nothing yet.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">By difficulty</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">Difficulty</th><th>Solved</th><th>You accepted</th></tr></thead>
              <tbody>
                {data.byDifficulty.map((d) => (
                  <tr key={d.difficulty} className="border-t"><td className="py-1 capitalize">{d.difficulty}</td><td>{d.solved}</td><td>{pct(d.acceptRate)}</td></tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">What students say</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <div className="flex flex-wrap gap-2">
              {data.feedback.tags.map((t) => (
                <span key={t.tag} className={`rounded-full border px-2 py-0.5 ${t.tag === 'not_resolved' ? 'border-amber-500 text-amber-700' : ''}`}>
                  {TAG_LABEL[t.tag] ?? t.tag} · {t.n}
                </span>
              ))}
            </div>
            {data.feedback.recentComments.map((c, i) => (
              <p key={i} className="border-t pt-2">
                “{c.comment}” <span className="text-muted-foreground">— {c.studentFirstName}, {c.stars}★</span>
              </p>
            ))}
            {data.feedback.tags.length === 0 && <p className="text-muted-foreground">No ratings yet.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Activity, last 14 days</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">Day</th><th>Hours online</th><th>Sessions</th></tr></thead>
              <tbody>
                {data.activity.map((a) => (
                  <tr key={a.day} className="border-t"><td className="py-1">{dayKeyToDMY(a.day)}</td><td>{a.hoursOnline}</td><td>{a.sessions}</td></tr>
                ))}
              </tbody>
            </table>
            {data.activity.length === 0 && <p className="text-sm text-muted-foreground">Go online to start your activity log.</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Level and what students see</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-start justify-between gap-4 text-sm">
          <ul>
            {data.standing.levels.map((l) => (
              <li key={l.subject} className="capitalize">{l.subject}: <strong>{l.level}</strong></li>
            ))}
          </ul>
          <div className="rounded-lg border p-3">
            <p className="font-semibold">{data.publicCard.name}</p>
            <p className="text-xs capitalize text-muted-foreground">{data.publicCard.subjects.join(', ')}</p>
            <p className="flex items-center gap-1 text-xs">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {data.publicCard.averageStars?.toFixed(1) ?? 'new'} · {data.publicCard.sessions} sessions
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">Your age, school and contact details are never shown.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
