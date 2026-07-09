'use client';

/**
 * AI Feature Toggle admin console (client). Four sections — global master
 * switch, tier cards, institutes/batches browser, find-a-student — all writing
 * through PUT /api/admin/ai-access/rule. Toggles only restrict; they never
 * bypass the premium paywall. Design: V1/ai-feature-toggle/05-admin-ui.md.
 */

import { useCallback, useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { apiJson } from '@/lib/teacher-client';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

type RuleValue = 'on' | 'off' | 'inherit';
type Decision = {
  originAi: boolean;
  aiExplainer: boolean;
  decidedBy: { originAi: string; aiExplainer: string };
};
type TierState = { value: RuleValue; updatedAt: string | null; updatedBy: string | null };
type Overview = {
  flagEnabled: boolean;
  redisConfigured: boolean;
  global: { originAi: boolean; aiExplainer: boolean; updatedAt: string | null; updatedBy: string | null };
  tiers: { free: TierState; premium: TierState };
  counts: { workspaceRules: number; batchRules: number; userOverrides: number };
  studentCounts: { free: number; premium: number };
  orphans: { scopeType: string; scopeId: string; value: RuleValue }[];
};
type Member = {
  userId: string;
  name: string;
  username: string | null;
  email: string;
  isPremium: boolean;
  override: RuleValue;
  effective: Decision;
};
type BatchItem = { id: string; name: string; status: string; memberCount: number; rule: RuleValue };
type WorkspaceItem = {
  id: string;
  name: string;
  type: string;
  status: string;
  enrollmentCount: number;
  rule: RuleValue;
  batches: BatchItem[];
};

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const s = Math.round((Date.now() - then) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const PUT_URL = '/api/admin/ai-access';

// ── Small shared controls ─────────────────────────────────────────────────

function RuleToggle({
  value,
  onChange,
  disabled,
}: {
  value: RuleValue;
  onChange: (v: RuleValue) => void;
  disabled?: boolean;
}) {
  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v as RuleValue);
      }}
      disabled={disabled}
    >
      <ToggleGroupItem value="inherit" className="px-2 text-xs">Inherit</ToggleGroupItem>
      <ToggleGroupItem value="on" className="px-2 text-xs">On</ToggleGroupItem>
      <ToggleGroupItem value="off" className="px-2 text-xs">Off</ToggleGroupItem>
    </ToggleGroup>
  );
}

function EffectiveBadge({ decision }: { decision: Decision }) {
  const on = decision.originAi;
  return (
    <Badge
      variant={on ? 'default' : 'destructive'}
      title={`decided by: ${decision.decidedBy.originAi}`}
    >
      {on ? 'AI On' : 'AI Off'}
    </Badge>
  );
}

function MemberRow({
  m,
  onSetOverride,
  onWhy,
  disabled,
}: {
  m: Member;
  onSetOverride: (userId: string, v: RuleValue) => void;
  onWhy?: (userId: string) => void;
  disabled?: boolean;
}) {
  return (
    <tr className="border-t border-border/60">
      <td className="px-3 py-2">
        <div className="font-medium text-foreground">{m.name || '—'}</div>
        <div className="text-xs text-muted-foreground">
          {m.username ? `@${m.username} · ` : ''}
          {m.email}
        </div>
      </td>
      <td className="px-3 py-2">
        <Badge variant="secondary">{m.isPremium ? 'Premium' : 'Free'}</Badge>
      </td>
      <td className="px-3 py-2">
        <RuleToggle value={m.override} onChange={(v) => onSetOverride(m.userId, v)} disabled={disabled} />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <EffectiveBadge decision={m.effective} />
          {onWhy && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onWhy(m.userId)}>
              Why?
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────

export default function AdminAiAccessPanel({ initialOverview }: { initialOverview: Overview }) {
  const [overview, setOverview] = useState<Overview>(initialOverview);
  const [pending, start] = useTransition();
  const [confirmGlobalOff, setConfirmGlobalOff] = useState(false);

  const refetchOverview = useCallback(async () => {
    const r = await apiJson<Overview>(PUT_URL, { method: 'GET' });
    if (r.ok) setOverview(r.data);
  }, []);

  const setRule = useCallback(
    (scopeType: string, scopeId: string, value: RuleValue, after?: () => void | Promise<void>) => {
      start(async () => {
        const r = await apiJson<{ rule: unknown; previous: RuleValue }>(`${PUT_URL}/rule`, {
          method: 'PUT',
          json: { scopeType, scopeId, value },
        });
        if (!r.ok) {
          toast.error(r.detail || 'Failed to update rule.');
          return;
        }
        await refetchOverview();
        if (after) await after();
      });
    },
    [refetchOverview],
  );

  const globalOn = overview.global.originAi;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">AI Access</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Control who can use Origin AI (Ori) and the AI Explainer. Toggles only restrict access —
          they never bypass the premium paywall. Changes take effect within seconds.
        </p>
      </div>

      {!overview.redisConfigured && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          Redis is not configured — toggles work but only per-instance until deploy.
        </div>
      )}

      {/* [1] GLOBAL */}
      <Card>
        <CardHeader>
          <CardTitle>Global</CardTitle>
          <CardDescription>Master kill switch for every student and the public demo widget.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Switch
                checked={globalOn}
                disabled={pending}
                onCheckedChange={(next) => {
                  if (!next) setConfirmGlobalOff(true);
                  else setRule('global', '', 'on');
                }}
              />
              <Badge variant={globalOn ? 'default' : 'destructive'}>
                {globalOn ? 'AI enabled globally' : 'AI KILLED globally'}
              </Badge>
              {overview.global.updatedAt && (
                <span className="text-xs text-muted-foreground">
                  Last changed {timeAgo(overview.global.updatedAt)}
                  {overview.global.updatedBy ? ` by ${overview.global.updatedBy}` : ''}
                </span>
              )}
            </div>
          </div>
          {confirmGlobalOff && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <p className="text-foreground">
                This immediately disables Ori and the AI Explainer for <b>every</b> student in the app,
                and pauses the public demo widget. Individual ON overrides will NOT apply while the
                global switch is off.
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={pending}
                  onClick={() => setRule('global', '', 'off', () => setConfirmGlobalOff(false))}
                >
                  Yes, disable AI globally
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmGlobalOff(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">The landing-page demo widget follows this switch.</p>
        </CardContent>
      </Card>

      {/* [2] TIERS */}
      <div className="grid gap-4 md:grid-cols-2">
        <TierCard
          title="Free students"
          count={overview.studentCounts.free}
          state={overview.tiers.free}
          note="Free students are additionally limited by the premium paywall — turning this ON does not grant them Ori usage."
          disabled={pending}
          onSet={(v) => setRule('tier', 'free', v)}
        />
        <TierCard
          title="Premium Pro students"
          count={overview.studentCounts.premium}
          state={overview.tiers.premium}
          disabled={pending}
          onSet={(v) => setRule('tier', 'premium', v)}
        />
      </div>

      {/* [3] INSTITUTES & BATCHES */}
      <InstitutesSection pending={pending} onSetRule={setRule} />

      {/* [4] FIND A STUDENT */}
      <StudentSection pending={pending} onSetRule={setRule} />

      {/* [6] ORPHANS */}
      {overview.orphans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Stale rules</CardTitle>
            <CardDescription>Rules pointing at deleted institutes/batches. Clearing sets them to inherit.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {overview.orphans.map((o) => (
              <div key={`${o.scopeType}:${o.scopeId}`} className="flex items-center justify-between text-sm">
                <span className="font-mono text-xs text-muted-foreground">
                  {o.scopeType}:{o.scopeId} = {o.value}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => setRule(o.scopeType, o.scopeId, 'inherit')}
                >
                  Clear
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TierCard({
  title,
  count,
  state,
  note,
  disabled,
  onSet,
}: {
  title: string;
  count: number;
  state: TierState;
  note?: string;
  disabled?: boolean;
  onSet: (v: RuleValue) => void;
}) {
  const on = state.value !== 'off';
  const chip =
    state.value === 'inherit' ? 'Default (On)' : state.value === 'on' ? 'Explicit On' : 'Off';
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{count.toLocaleString()} students</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Switch
            checked={on}
            disabled={disabled}
            onCheckedChange={(next) => onSet(next ? 'on' : 'off')}
          />
          <Badge variant={on ? 'default' : 'destructive'}>{chip}</Badge>
          {state.value !== 'inherit' && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={disabled} onClick={() => onSet('inherit')}>
              Reset to default
            </Button>
          )}
        </div>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </CardContent>
    </Card>
  );
}

function InstitutesSection({
  pending,
  onSetRule,
}: {
  pending: boolean;
  onSetRule: (scopeType: string, scopeId: string, value: RuleValue, after?: () => void | Promise<void>) => void;
}) {
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query, 300);
  const [items, setItems] = useState<WorkspaceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const r = await apiJson<{ items: WorkspaceItem[]; total: number }>(
      `${PUT_URL}/workspaces?query=${encodeURIComponent(debounced)}`,
      { method: 'GET' },
    );
    setLoading(false);
    if (r.ok) setItems(r.data.items);
  }, [debounced]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleWs = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Institutes &amp; batches</CardTitle>
        <CardDescription>
          Kill a whole batch with one control, then rescue a special student via their Override.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search institutes…"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && items.length === 0 && (
          <p className="text-sm text-muted-foreground">No institutes with enrolled students yet.</p>
        )}
        {items.map((w) => (
          <div key={w.id} className="rounded-lg border border-border">
            <div className="flex flex-wrap items-center justify-between gap-2 p-3">
              <button className="flex items-center gap-2 text-left" onClick={() => toggleWs(w.id)}>
                <span className="text-muted-foreground">{expanded.has(w.id) ? '▾' : '▸'}</span>
                <span className="font-medium text-foreground">{w.name || w.id}</span>
                <Badge variant="secondary">{w.type}</Badge>
                <span className="text-xs text-muted-foreground">{w.enrollmentCount} enrolled</span>
              </button>
              <RuleToggle value={w.rule} disabled={pending} onChange={(v) => onSetRule('workspace', w.id, v, load)} />
            </div>
            {expanded.has(w.id) && (
              <div className="border-t border-border/60 p-3">
                {w.batches.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No draft/active batches.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {w.batches.map((b) => (
                      <BatchRow key={b.id} batch={b} pending={pending} onSetRule={onSetRule} refreshWs={load} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function BatchRow({
  batch,
  pending,
  onSetRule,
  refreshWs,
}: {
  batch: BatchItem;
  pending: boolean;
  onSetRule: (scopeType: string, scopeId: string, value: RuleValue, after?: () => void | Promise<void>) => void;
  refreshWs: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [q, setQ] = useState('');
  const debounced = useDebouncedValue(q, 300);
  const limit = 50;

  const loadMembers = useCallback(async () => {
    const r = await apiJson<{ members: Member[]; total: number }>(
      `${PUT_URL}/batches/${encodeURIComponent(batch.id)}/members?query=${encodeURIComponent(debounced)}&limit=${limit}&offset=${offset}`,
      { method: 'GET' },
    );
    if (r.ok) {
      setMembers(r.data.members);
      setTotal(r.data.total);
    }
  }, [batch.id, debounced, offset]);

  useEffect(() => {
    if (open) void loadMembers();
  }, [open, loadMembers]);

  return (
    <div className="rounded-lg border border-border/60">
      <div className="flex flex-wrap items-center justify-between gap-2 p-2">
        <button className="flex items-center gap-2 text-left" onClick={() => setOpen((v) => !v)}>
          <span className="text-muted-foreground">{open ? '▾' : '▸'}</span>
          <span className="text-sm font-medium text-foreground">{batch.name || batch.id}</span>
          <Badge variant="secondary">{batch.status}</Badge>
          <span className="text-xs text-muted-foreground">{batch.memberCount} members</span>
        </button>
        <RuleToggle value={batch.rule} disabled={pending} onChange={(v) => onSetRule('batch', batch.id, v, refreshWs)} />
      </div>
      {open && (
        <div className="border-t border-border/60 p-2">
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOffset(0);
            }}
            placeholder="Search members…"
            className="mb-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
          />
          {members.length === 0 ? (
            <p className="px-1 py-2 text-sm text-muted-foreground">No active members.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Student</th>
                    <th className="px-3 py-2 font-semibold">Tier</th>
                    <th className="px-3 py-2 font-semibold">Override</th>
                    <th className="px-3 py-2 font-semibold">Effective</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <MemberRow
                      key={m.userId}
                      m={m}
                      disabled={pending}
                      onSetOverride={(userId, v) => onSetRule('user', userId, v, loadMembers)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {total > limit && (
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {offset + 1}–{Math.min(offset + limit, total)} of {total}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>
                  Prev
                </Button>
                <Button variant="outline" size="sm" disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StudentSection({
  pending,
  onSetRule,
}: {
  pending: boolean;
  onSetRule: (scopeType: string, scopeId: string, value: RuleValue, after?: () => void | Promise<void>) => void;
}) {
  const [tier, setTier] = useState<'free' | 'premium'>('free');
  const [q, setQ] = useState('');
  const debounced = useDebouncedValue(q, 300);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [why, setWhy] = useState<WhyChain | null>(null);

  const load = useCallback(async () => {
    if (debounced.trim().length < 2) {
      setMembers([]);
      return;
    }
    setLoading(true);
    const r = await apiJson<{ members: Member[]; total: number }>(
      `${PUT_URL}/students?tier=${tier}&query=${encodeURIComponent(debounced)}`,
      { method: 'GET' },
    );
    setLoading(false);
    if (r.ok) setMembers(r.data.members);
  }, [tier, debounced]);

  useEffect(() => {
    void load();
  }, [load]);

  const openWhy = async (userId: string) => {
    const r = await apiJson<WhyChain>(`${PUT_URL}/users/${encodeURIComponent(userId)}`, { method: 'GET' });
    if (r.ok) setWhy(r.data);
    else toast.error(r.detail || 'Failed to load.');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Find a student</CardTitle>
        <CardDescription>Search any student to see their effective state, override it, or ask why.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <ToggleGroup type="single" size="sm" variant="outline" value={tier} onValueChange={(v) => v && setTier(v as 'free' | 'premium')}>
            <ToggleGroupItem value="free" className="px-3 text-xs">Free</ToggleGroupItem>
            <ToggleGroupItem value="premium" className="px-3 text-xs">Premium</ToggleGroupItem>
          </ToggleGroup>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name / email / @username (≥2 chars)…"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        {loading && <p className="text-sm text-muted-foreground">Searching…</p>}
        {!loading && members.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-semibold">Student</th>
                  <th className="px-3 py-2 font-semibold">Tier</th>
                  <th className="px-3 py-2 font-semibold">Override</th>
                  <th className="px-3 py-2 font-semibold">Effective</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <MemberRow
                    key={m.userId}
                    m={m}
                    disabled={pending}
                    onSetOverride={(userId, v) => onSetRule('user', userId, v, load)}
                    onWhy={openWhy}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {why && <WhyPanel why={why} onClose={() => setWhy(null)} />}
      </CardContent>
    </Card>
  );
}

type WhyChain = {
  user: { id: string; name: string; email: string; username: string | null; role: string; isPremium: boolean };
  effective: Decision;
  chain: Array<
    | { level: string; value: RuleValue }
    | { level: string; tier: string; value: RuleValue }
    | { level: string; rules: { id: string; name: string; value: RuleValue }[] }
  >;
};

function WhyPanel({ why, onClose }: { why: WhyChain; onClose: () => void }) {
  const winner = why.effective.decidedBy.originAi;
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
      <div className="flex items-center justify-between">
        <div className="font-medium text-foreground">
          {why.user.name || why.user.email} — <EffectiveBadge decision={why.effective} />
        </div>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClose}>
          Close
        </Button>
      </div>
      <ul className="mt-2 flex flex-col gap-1">
        {why.chain.map((row, i) => {
          const highlight = row.level === winner;
          const cls = highlight ? 'font-semibold text-foreground' : 'text-muted-foreground';
          if ('rules' in row) {
            return (
              <li key={i} className={cls}>
                {row.level}:{' '}
                {row.rules.length === 0
                  ? '—'
                  : row.rules.map((r) => `${r.name} = ${r.value}`).join(', ')}
              </li>
            );
          }
          if ('tier' in row) {
            return (
              <li key={i} className={cls}>
                {row.level} ({row.tier}) = {row.value}
              </li>
            );
          }
          return (
            <li key={i} className={cls}>
              {row.level} = {row.value}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
