'use client';

/**
 * Admin Control Plane — financials.
 *
 * Every number on this screen comes from `/api/admin/payments/summary`, which
 * reads the money ledger directly. There are no sample series and no rounded
 * "looks about right" figures: if the ledger is empty the screen says so rather
 * than drawing a chart of nothing.
 *
 * Plan: V1/RAZORPAY_PAYMENTS_PLAN.md §8 Phase 8.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Activity,
    AlertTriangle,
    ArrowUpRight,
    CheckCircle2,
    CreditCard,
    Download,
    IndianRupee,
    Loader2,
    RefreshCw,
    Repeat,
    Ticket,
    TrendingUp,
    Users,
} from 'lucide-react';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { toast } from 'sonner';

type DayPoint = {
    date: string;
    grossMinor: number;
    refundedMinor: number;
    netMinor: number;
    payments: number;
    refunds: number;
};
type Slice = { key: string; label: string; grossMinor: number; payments: number };
type Summary = {
    livemode: boolean;
    range: { fromDay: string; toDay: string; days: number };
    generatedAt: string;
    totals: {
        grossMinor: number;
        refundedMinor: number;
        netMinor: number;
        payments: number;
        refunds: number;
        payingUsers: number;
        averageOrderValueMinor: number;
        refundRate: number;
        disputes: number;
    };
    byDay: DayPoint[];
    bySubject: Slice[];
    byMethod: Slice[];
    byKind: Slice[];
    mrr: {
        recurringMinor: number;
        activeSubscriptions: number;
        prepaidNormalisedMinor: number;
        activePrepaidOrders: number;
        totalMinor: number;
        subscriptionsAvailable: boolean;
    };
    coupons: Array<{ code: string; orders: number; discountMinor: number; grossMinor: number }>;
    funnel: {
        ordersCreated: number;
        ordersPaid: number;
        ordersFailed: number;
        ordersExpired: number;
        conversionRate: number;
    };
};
type Health = {
    ok: boolean;
    featureEnabled: boolean;
    razorpay: { mode: string; livemode: boolean; keyIdConfigured: boolean; keySecretConfigured: boolean; webhookSecretConfigured: boolean; modeMismatch: string | null; subscriptionsEnabled: boolean };
    qstashConfigured: boolean;
    redisConfigured: boolean;
    databaseConfigured: boolean;
    backlog: {
        pendingEvents: number;
        failedEvents: number;
        pendingOutbox: number;
        failedOutbox: number;
        stuckOrders: number;
        lastWebhookAt: string | null;
        lastPaidAt: string | null;
    } | null;
    backlogError: string | null;
    problems: string[];
};
type SummaryResponse = { livemode: boolean; summary: Summary | null; health: Health };

type LedgerRow = {
    orderId: string;
    createdAt: string;
    paidAt: string | null;
    status: string;
    kind: string;
    subject: string | null;
    termMonths: number;
    amountMinor: number;
    discountMinor: number;
    amountRefundedMinor: number;
    currency: string;
    couponCode: string | null;
    method: string | null;
    razorpayPaymentId: string | null;
    userEmail: string | null;
    userName: string | null;
};
type LedgerPage = {
    rows: LedgerRow[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
    subscriptionCharges: number;
};

const RANGES = [
    { days: 7, label: '7D' },
    { days: 30, label: '30D' },
    { days: 90, label: '90D' },
    { days: 365, label: '1Y' },
];

const STATUS_TONE: Record<string, string> = {
    paid: 'text-emerald-500',
    refunded: 'text-rose-500',
    partially_refunded: 'text-amber-500',
    failed: 'text-rose-500',
    expired: 'text-muted-foreground',
    created: 'text-blue-500',
    attempted: 'text-blue-500',
};

/** Minor units are paise. Never render a float — round once, at the edge. */
function rupees(minor: number): string {
    return `₹${Math.round(minor / 100).toLocaleString('en-IN')}`;
}

function compactRupees(minor: number): string {
    const value = minor / 100;
    if (Math.abs(value) >= 10_000_000) return `₹${(value / 10_000_000).toFixed(1)}Cr`;
    if (Math.abs(value) >= 100_000) return `₹${(value / 100_000).toFixed(1)}L`;
    if (Math.abs(value) >= 1_000) return `₹${(value / 1_000).toFixed(1)}k`;
    return `₹${Math.round(value)}`;
}

function percent(ratio: number): string {
    return `${(ratio * 100).toFixed(ratio >= 0.1 ? 1 : 2)}%`;
}

/** Recharts hands the formatter a loosely typed value; render only real numbers. */
function tooltipRupees(value: unknown): string {
    const n = Number(value);
    return Number.isFinite(n) ? `₹${n.toLocaleString('en-IN')}` : '—';
}

function dayLabel(date: string): string {
    const [, month, day] = date.split('-');
    return `${day}/${month}`;
}

function StatCard({ title, value, hint, icon: Icon, tone }: {
    title: string;
    value: string;
    hint: string;
    icon: typeof TrendingUp;
    tone: 'blue' | 'emerald' | 'amber' | 'purple';
}) {
    const toneClass = {
        blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
        emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
        amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
        purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    }[tone];
    return (
        <div className="neu-raised rounded-3xl p-8">
            <div className="flex items-start justify-between mb-6">
                <div className={`p-4 rounded-2xl border ${toneClass}`}>
                    <Icon className="w-6 h-6" />
                </div>
            </div>
            <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em] mb-2 break-words">{title}</p>
            <h3 className="text-3xl font-black text-foreground tabular-nums truncate">{value}</h3>
            <p className="mt-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{hint}</p>
        </div>
    );
}

export function AdminFinancialsPanel() {
    const [days, setDays] = useState(30);
    const [livemode, setLivemode] = useState<boolean | null>(null);
    const [data, setData] = useState<SummaryResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [ledger, setLedger] = useState<LedgerPage | null>(null);
    const [ledgerStatus, setLedgerStatus] = useState('');
    const [ledgerQuery, setLedgerQuery] = useState('');
    const [ledgerLoading, setLedgerLoading] = useState(false);
    const [exporting, setExporting] = useState(false);

    const modeParam = livemode === null ? '' : `&livemode=${livemode ? '1' : '0'}`;

    const loadSummary = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/payments/summary?days=${days}${modeParam}`, {
                credentials: 'include',
                cache: 'no-store',
            });
            if (!res.ok) {
                throw new Error((await res.json().catch(() => ({})))?.detail || `Request failed (${res.status})`);
            }
            const body = (await res.json()) as SummaryResponse;
            setData(body);
            setLivemode((current) => (current === null ? body.livemode : current));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not load financials.');
        } finally {
            setLoading(false);
        }
    }, [days, modeParam]);

    const loadLedger = useCallback(async () => {
        setLedgerLoading(true);
        try {
            const params = new URLSearchParams({ days: String(days), limit: '25' });
            if (livemode !== null) params.set('livemode', livemode ? '1' : '0');
            if (ledgerStatus) params.set('status', ledgerStatus);
            if (ledgerQuery.trim()) params.set('q', ledgerQuery.trim());
            const res = await fetch(`/api/admin/payments?${params.toString()}`, {
                credentials: 'include',
                cache: 'no-store',
            });
            if (!res.ok) {
                throw new Error((await res.json().catch(() => ({})))?.detail || `Request failed (${res.status})`);
            }
            setLedger((await res.json()) as LedgerPage);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not load the ledger.');
        } finally {
            setLedgerLoading(false);
        }
    }, [days, livemode, ledgerStatus, ledgerQuery]);

    useEffect(() => { void loadSummary(); }, [loadSummary]);
    useEffect(() => { void loadLedger(); }, [loadLedger]);

    async function exportCsv() {
        setExporting(true);
        try {
            const params = new URLSearchParams({ days: String(days), format: 'csv' });
            if (livemode !== null) params.set('livemode', livemode ? '1' : '0');
            if (ledgerStatus) params.set('status', ledgerStatus);
            if (ledgerQuery.trim()) params.set('q', ledgerQuery.trim());
            const res = await fetch(`/api/admin/payments?${params.toString()}`, {
                credentials: 'include',
                cache: 'no-store',
            });
            if (!res.ok) throw new Error(`Export failed (${res.status})`);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `origin-payments-${livemode ? 'live' : 'test'}-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Export failed.');
        } finally {
            setExporting(false);
        }
    }

    const summary = data?.summary ?? null;
    const health = data?.health ?? null;

    const chartData = useMemo(
        () => (summary?.byDay ?? []).map((point) => ({
            name: dayLabel(point.date),
            gross: point.grossMinor / 100,
            net: point.netMinor / 100,
        })),
        [summary],
    );
    const subjectData = useMemo(
        () => (summary?.bySubject ?? []).map((slice) => ({ name: slice.label, gross: slice.grossMinor / 100 })),
        [summary],
    );

    const chartTooltip = {
        backgroundColor: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        borderRadius: '16px',
        padding: '12px',
    };

    return (
        <div className="space-y-10 pb-24">
            {/* Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-tight text-foreground">Financials</h1>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-2">
                        {summary
                            ? `${summary.range.fromDay} → ${summary.range.toDay} IST · ${summary.livemode ? 'live' : 'test'} mode`
                            : 'Reading the money ledger…'}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1 p-1 rounded-2xl bg-card border border-border/30">
                        {RANGES.map((range) => (
                            <button
                                key={range.days}
                                onClick={() => setDays(range.days)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                    days === range.days ? 'bg-emerald-500 text-zinc-950' : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                {range.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-1 p-1 rounded-2xl bg-card border border-border/30">
                        {[
                            { value: false, label: 'Test' },
                            { value: true, label: 'Live' },
                        ].map((option) => (
                            <button
                                key={option.label}
                                onClick={() => setLivemode(option.value)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                    livemode === option.value ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => { void loadSummary(); void loadLedger(); }}
                        className="p-3 bg-card border border-border/30 rounded-2xl text-muted-foreground hover:text-foreground transition-all"
                        aria-label="Refresh"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {error && (
                <div className="rounded-3xl border border-rose-500/30 bg-rose-500/5 p-6 flex items-start gap-4">
                    <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-black uppercase tracking-widest text-rose-500">Financials unavailable</p>
                        <p className="text-xs text-muted-foreground mt-2">{error}</p>
                    </div>
                </div>
            )}

            {/* Health */}
            {health && (
                <div className={`rounded-3xl border p-6 ${health.ok ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
                    <div className="flex items-start gap-4">
                        {health.ok
                            ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                            : <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />}
                        <div className="min-w-0 flex-1">
                            <p className={`text-sm font-black uppercase tracking-widest ${health.ok ? 'text-emerald-500' : 'text-amber-500'}`}>
                                {health.ok ? 'Payments healthy' : 'Payments need attention'}
                            </p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">
                                {health.razorpay.mode} mode · checkout {health.featureEnabled ? 'enabled' : 'disabled'} ·
                                {' '}redis {health.redisConfigured ? 'on' : 'off'} · qstash {health.qstashConfigured ? 'on' : 'off'}
                            </p>
                            {health.problems.length > 0 && (
                                <ul className="mt-3 space-y-1">
                                    {health.problems.map((problem) => (
                                        <li key={problem} className="text-xs text-muted-foreground">• {problem}</li>
                                    ))}
                                </ul>
                            )}
                            {health.backlog && (
                                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {[
                                        { label: 'Pending events', value: health.backlog.pendingEvents },
                                        { label: 'Failed events', value: health.backlog.failedEvents },
                                        { label: 'Pending outbox', value: health.backlog.pendingOutbox },
                                        { label: 'Stuck orders', value: health.backlog.stuckOrders },
                                    ].map((tile) => (
                                        <div key={tile.label}>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{tile.label}</p>
                                            <p className="text-xl font-black tabular-nums text-foreground">{tile.value}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {health.backlog?.lastWebhookAt && (
                                <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Last webhook {new Date(health.backlog.lastWebhookAt).toLocaleString('en-IN')}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {loading && !summary && (
                <div className="flex items-center justify-center py-24">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                </div>
            )}

            {summary && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        <StatCard
                            title="Net revenue"
                            value={rupees(summary.totals.netMinor)}
                            hint={`${rupees(summary.totals.grossMinor)} gross − ${rupees(summary.totals.refundedMinor)} refunded`}
                            icon={IndianRupee}
                            tone="emerald"
                        />
                        <StatCard
                            title="Monthly run rate"
                            value={rupees(summary.mrr.totalMinor)}
                            hint={`${summary.mrr.activeSubscriptions} mandates · ${summary.mrr.activePrepaidOrders} live prepaid terms`}
                            icon={Repeat}
                            tone="blue"
                        />
                        <StatCard
                            title="Paying students"
                            value={summary.totals.payingUsers.toLocaleString('en-IN')}
                            hint={`${summary.totals.payments} charges · avg ${rupees(summary.totals.averageOrderValueMinor)}`}
                            icon={Users}
                            tone="purple"
                        />
                        <StatCard
                            title="Refund rate"
                            value={percent(summary.totals.refundRate)}
                            hint={`${summary.totals.refunds} refunds · ${summary.totals.disputes} disputes`}
                            icon={TrendingUp}
                            tone="amber"
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 neu-raised rounded-[2.5rem] p-8 lg:p-10 flex flex-col">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                                <div>
                                    <h3 className="text-xl font-black uppercase tracking-tight text-foreground">Revenue by IST day</h3>
                                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">
                                        Gross captured vs net of refunds
                                    </p>
                                </div>
                            </div>
                            <div className="flex-1 min-h-[320px]">
                                {summary.totals.payments === 0 ? (
                                    <div className="h-full min-h-[320px] flex flex-col items-center justify-center gap-3 text-center">
                                        <Activity className="w-8 h-8 text-muted-foreground/40" />
                                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                            No captured charges in this window
                                        </p>
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartData}>
                                            <defs>
                                                <linearGradient id="grossFill" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} minTickGap={24}
                                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 700 }} dy={12} />
                                            <YAxis axisLine={false} tickLine={false}
                                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 700 }}
                                                tickFormatter={(value: number) => compactRupees(value * 100)} />
                                            <Tooltip contentStyle={chartTooltip} formatter={tooltipRupees} />
                                            <Area type="monotone" dataKey="gross" stroke="#3b82f6" strokeWidth={3}
                                                fillOpacity={1} fill="url(#grossFill)" name="Gross" />
                                            <Area type="monotone" dataKey="net" stroke="#10b981" strokeWidth={2}
                                                fillOpacity={0} name="Net" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>

                        <div className="space-y-8">
                            <div className="neu-raised rounded-[2rem] p-8">
                                <h3 className="text-sm font-black uppercase tracking-[0.22em] text-muted-foreground mb-6">Checkout funnel</h3>
                                <div className="space-y-3">
                                    {[
                                        { label: 'Opened', value: summary.funnel.ordersCreated },
                                        { label: 'Paid', value: summary.funnel.ordersPaid },
                                        { label: 'Failed', value: summary.funnel.ordersFailed },
                                        { label: 'Expired', value: summary.funnel.ordersExpired },
                                    ].map((row) => (
                                        <div key={row.label} className="flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{row.label}</span>
                                            <span className="text-sm font-black tabular-nums text-foreground">{row.value}</span>
                                        </div>
                                    ))}
                                    <div className="pt-3 mt-3 border-t border-border/30 flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Conversion</span>
                                        <span className="text-sm font-black tabular-nums text-emerald-500">{percent(summary.funnel.conversionRate)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="neu-raised rounded-[2rem] p-8">
                                <h3 className="text-sm font-black uppercase tracking-[0.22em] text-muted-foreground mb-6">By method</h3>
                                {summary.byMethod.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">No captured charges yet.</p>
                                ) : (
                                    <div className="space-y-4">
                                        {summary.byMethod.map((slice) => (
                                            <div key={slice.key} className="flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <CreditCard className="w-4 h-4 text-muted-foreground shrink-0" />
                                                    <span className="text-xs font-black text-foreground truncate">{slice.label}</span>
                                                </div>
                                                <span className="text-xs font-black tabular-nums text-muted-foreground shrink-0">
                                                    {rupees(slice.grossMinor)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="neu-raised rounded-[2rem] p-8">
                                <h3 className="text-sm font-black uppercase tracking-[0.22em] text-muted-foreground mb-6">Coupon attribution</h3>
                                {summary.coupons.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">No coupon was redeemed in this window.</p>
                                ) : (
                                    <div className="space-y-4">
                                        {summary.coupons.slice(0, 6).map((coupon) => (
                                            <div key={coupon.code} className="flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <Ticket className="w-4 h-4 text-muted-foreground shrink-0" />
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-black text-foreground truncate">{coupon.code}</p>
                                                        <p className="text-[10px] font-bold text-muted-foreground uppercase">
                                                            {coupon.orders} order{coupon.orders === 1 ? '' : 's'} · −{rupees(coupon.discountMinor)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className="text-xs font-black tabular-nums text-emerald-500 shrink-0">
                                                    {rupees(coupon.grossMinor)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="neu-raised rounded-[2.5rem] p-8 lg:p-10">
                        <h3 className="text-xl font-black uppercase tracking-tight text-foreground mb-8">Revenue by subject</h3>
                        {subjectData.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Nothing captured in this window.</p>
                        ) : (
                            <div className="h-[280px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={subjectData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false}
                                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 700 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false}
                                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 700 }}
                                            tickFormatter={(value: number) => compactRupees(value * 100)} />
                                        <Tooltip contentStyle={chartTooltip} formatter={tooltipRupees} />
                                        <Bar dataKey="gross" fill="#8b5cf6" radius={[8, 8, 0, 0]} name="Gross" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Ledger browser */}
            <div className="neu-raised rounded-[2.5rem] p-8 lg:p-10">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
                    <div>
                        <h3 className="text-xl font-black uppercase tracking-tight text-foreground">Order ledger</h3>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">
                            {ledger ? `${ledger.total} order${ledger.total === 1 ? '' : 's'} in range` : 'Loading…'}
                            {ledger && ledger.subscriptionCharges > 0
                                ? ` · ${ledger.subscriptionCharges} mandate charge(s) without an order`
                                : ''}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <input
                            value={ledgerQuery}
                            onChange={(event) => setLedgerQuery(event.target.value)}
                            placeholder="Order id, payment id or email"
                            className="px-4 py-2.5 rounded-2xl bg-card border border-border/30 text-xs text-foreground placeholder:text-muted-foreground min-w-[240px] focus:outline-none focus:border-emerald-500/50"
                        />
                        <select
                            value={ledgerStatus}
                            onChange={(event) => setLedgerStatus(event.target.value)}
                            className="px-4 py-2.5 rounded-2xl bg-card border border-border/30 text-xs font-bold text-foreground focus:outline-none"
                        >
                            <option value="">All statuses</option>
                            {['paid', 'created', 'attempted', 'failed', 'expired', 'refunded', 'partially_refunded'].map((status) => (
                                <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
                            ))}
                        </select>
                        <button
                            onClick={() => void exportCsv()}
                            disabled={exporting}
                            className="px-5 py-2.5 bg-emerald-500 text-zinc-950 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-emerald-400 active:scale-95 transition-all disabled:opacity-60 flex items-center gap-2"
                        >
                            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            CSV
                        </button>
                    </div>
                </div>

                {ledgerLoading && !ledger ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                    </div>
                ) : !ledger || ledger.rows.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-8">No orders match these filters.</p>
                ) : (
                    <div className="overflow-x-auto -mx-4 px-4">
                        <table className="w-full min-w-[880px] text-left">
                            <thead>
                                <tr className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                                    <th className="pb-4 pr-4">Order</th>
                                    <th className="pb-4 pr-4">Student</th>
                                    <th className="pb-4 pr-4">Item</th>
                                    <th className="pb-4 pr-4 text-right">Amount</th>
                                    <th className="pb-4 pr-4">Method</th>
                                    <th className="pb-4">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/30">
                                {ledger.rows.map((row) => (
                                    <tr key={row.orderId} className="text-xs">
                                        <td className="py-4 pr-4 align-top">
                                            <p className="font-mono text-[11px] text-foreground truncate max-w-[180px]">{row.orderId}</p>
                                            <p className="text-[10px] text-muted-foreground">
                                                {new Date(row.createdAt).toLocaleString('en-IN')}
                                            </p>
                                        </td>
                                        <td className="py-4 pr-4 align-top">
                                            <p className="text-foreground truncate max-w-[180px]">{row.userName ?? '—'}</p>
                                            <p className="text-[10px] text-muted-foreground truncate max-w-[180px]">{row.userEmail ?? '—'}</p>
                                        </td>
                                        <td className="py-4 pr-4 align-top">
                                            <p className="text-foreground capitalize">{row.subject ?? row.kind.replace(/_/g, ' ')}</p>
                                            <p className="text-[10px] text-muted-foreground">
                                                {row.termMonths} month{row.termMonths === 1 ? '' : 's'}
                                                {row.couponCode ? ` · ${row.couponCode}` : ''}
                                            </p>
                                        </td>
                                        <td className="py-4 pr-4 align-top text-right">
                                            <p className="font-black tabular-nums text-foreground">{rupees(row.amountMinor)}</p>
                                            {row.amountRefundedMinor > 0 && (
                                                <p className="text-[10px] text-rose-500 tabular-nums">−{rupees(row.amountRefundedMinor)}</p>
                                            )}
                                        </td>
                                        <td className="py-4 pr-4 align-top uppercase text-muted-foreground">{row.method ?? '—'}</td>
                                        <td className="py-4 align-top">
                                            <span className={`font-black uppercase text-[10px] tracking-widest ${STATUS_TONE[row.status] ?? 'text-muted-foreground'}`}>
                                                {row.status.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {ledger.hasMore && (
                            <p className="mt-6 text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <ArrowUpRight className="w-3.5 h-3.5" />
                                Showing the first {ledger.rows.length} of {ledger.total} — export the CSV for the full range
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
