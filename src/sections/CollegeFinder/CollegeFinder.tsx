'use client';

/**
 * College finder (plan §11.4), signed-in. Mobile first. The browser sends the
 * student's ranks and filters; the server answers one page (≤ 50 rows) of
 * Safe / Likely / Reach seats. No cut-off table ever reaches the browser.
 *
 * Privacy (plan §12.1): category, PwD, gender and home state live in this
 * tab's memory only. They are pre-filled from the Rank Predictor hand-off
 * (sessionStorage, read once) or from the predictor's opt-in "Remember my
 * details on this device"; this page never stores them itself.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Info, Loader2, RotateCcw, Search } from 'lucide-react';

import { trackEvent } from '@/lib/analytics';
import { INDIAN_STATES } from '@/lib/constants';
import { STATE_BODY_BY_STATE } from '@/lib/counselling/states';
import { BAND_HINT, BAND_LABEL, BODY_DATA_NOTE, CATEGORY_SEAT_LABEL, INSTITUTE_TYPE_LABEL, formatRank } from '@/lib/counselling/format';
import { CHANCE_BANDS, COUNSELLING_CATEGORIES, type ChanceBand, type CounsellingBody, type CounsellingCategory, type CounsellingExam, type CounsellingRanks, type InstituteType } from '@/lib/counselling/types';

import { fetchMeta, searchColleges, type CounsellingMeta, type SearchRequest, type SearchResponse } from './api';
import { takeHandoff } from './handoff';
import ResultRow, { BAND_ICON, BAND_STYLE } from './ResultRow';

const fieldFocus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const PAGE_SIZE = 50;
const MAX_RANK = 2_500_000;
const PREDICTOR_DETAILS_KEY = 'origin:rank-predictor:details';

type RankKey = keyof CounsellingRanks;
type Gender = 'male' | 'female' | 'other';

type RankField = { key: RankKey; label: string; hint?: string };

function rankFields(exam: CounsellingExam, category: CounsellingCategory, pwd: boolean, homeState: string): RankField[] {
  const cat = CATEGORY_SEAT_LABEL[category];
  if (exam === 'neet') {
    return [
      { key: 'neetAir', label: 'NEET All India rank (AIR)', hint: 'MCC and state quota lists use the AIR for every category.' },
      ...(homeState === 'Tamil Nadu' ? [{ key: 'neetTnStateRank' as const, label: 'Tamil Nadu state rank (optional)', hint: 'The Tamil Nadu list is by state rank.' }] : []),
    ];
  }
  const out: RankField[] = [{ key: 'jeeMainCrl', label: 'JEE Main rank (CRL)', hint: 'For NITs, IIITs and other GFTIs.' }];
  if (category !== 'general') out.push({ key: 'jeeMainCategory', label: `JEE Main ${cat} rank` });
  if (pwd) {
    out.push({ key: 'jeeMainPwdCrl', label: 'JEE Main PwD rank (CRL-PwD)' });
    if (category !== 'general') out.push({ key: 'jeeMainPwdCategory', label: `JEE Main ${cat} PwD rank` });
  }
  out.push({ key: 'jeeAdvCrl', label: 'JEE Advanced rank (CRL, optional)', hint: 'Only for IITs and IISc.' });
  if (category !== 'general') out.push({ key: 'jeeAdvCategory', label: `JEE Advanced ${cat} rank (optional)` });
  if (pwd) {
    out.push({ key: 'jeeAdvPwdCrl', label: 'JEE Advanced PwD rank (optional)' });
    if (category !== 'general') out.push({ key: 'jeeAdvPwdCategory', label: `JEE Advanced ${cat} PwD rank (optional)` });
  }
  return out;
}

function readRemembered(): { category: CounsellingCategory; pwd: boolean; homeState: string } | null {
  try {
    const raw = window.localStorage.getItem(PREDICTOR_DETAILS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { category?: string; pwd?: unknown; homeState?: unknown };
    if (!p.category || !(COUNSELLING_CATEGORIES as readonly string[]).includes(p.category)) return null;
    return {
      category: p.category as CounsellingCategory,
      pwd: p.pwd === true,
      homeState: typeof p.homeState === 'string' && (INDIAN_STATES as string[]).includes(p.homeState) ? p.homeState : '',
    };
  } catch {
    return null;
  }
}

function parseRank(text: string): number | null | 'invalid' {
  const t = text.replace(/[,\s]/gu, '');
  if (!t) return null;
  if (!/^\d{1,7}$/u.test(t)) return 'invalid';
  const n = Number(t);
  return n >= 1 && n <= MAX_RANK ? n : 'invalid';
}

function Chip({ selected, onClick, children, role = 'checkbox' }: { selected: boolean; onClick: () => void; children: React.ReactNode; role?: 'checkbox' | 'radio' }) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onClick}
      className={`inline-flex min-h-12 cursor-pointer items-center rounded-full border px-4 text-[14px] font-semibold ${fieldFocus} ${
        selected ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-foreground hover:bg-surface-2'
      }`}
    >
      {children}
    </button>
  );
}

type Query = SearchRequest;

export default function CollegeFinder({ initialExam }: { initialExam: CounsellingExam }) {
  const ids = useId();
  const [exam, setExam] = useState<CounsellingExam>(initialExam);
  const [rankText, setRankText] = useState<Partial<Record<RankKey, string>>>({});
  const [predicted, setPredicted] = useState<CounsellingRanks>({});
  const [category, setCategory] = useState<CounsellingCategory>('general');
  const [pwd, setPwd] = useState(false);
  const [gender, setGender] = useState<Gender>('male');
  const [homeState, setHomeState] = useState('');
  const [bodies, setBodies] = useState<CounsellingBody[]>([]);
  const [year, setYear] = useState<number | ''>('');
  const [types, setTypes] = useState<InstituteType[]>([]);
  const [instState, setInstState] = useState('');
  const [branch, setBranch] = useState('');
  const [roundMode, setRoundMode] = useState<'each' | 'final'>('each');
  const [sort, setSort] = useState<'competitive' | 'closest'>('competitive');
  const [band, setBand] = useState<ChanceBand | 'all'>('all');
  const [meta, setMeta] = useState<CounsellingMeta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<RankKey | 'ranks', string>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [lastQuery, setLastQuery] = useState<Query | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const autoRan = useRef(false);

  // Pre-fill: the predictor hand-off first, else the predictor's remembered details.
  const [handoffReady, setHandoffReady] = useState(false);
  const tookHandoff = useRef(false);
  useEffect(() => {
    // Once per page load (React dev runs effects twice; the hand-off is read-once).
    if (tookHandoff.current) return;
    tookHandoff.current = true;
    const h = takeHandoff();
    if (h) {
      setExam(h.exam);
      setPredicted(h.ranks);
      setCategory(h.category);
      setPwd(h.pwd);
      setHomeState(h.homeState);
    } else {
      const saved = readRemembered();
      if (saved) {
        setCategory(saved.category);
        setPwd(saved.pwd);
        setHomeState(saved.homeState);
      }
    }
    setHandoffReady(Boolean(h && Object.keys(h.ranks).length));
  }, []);

  useEffect(() => {
    let live = true;
    setMeta(null);
    setMetaError(null);
    fetchMeta(exam)
      .then((m) => {
        if (live) setMeta(m);
      })
      .catch((e: unknown) => {
        if (live) setMetaError(e instanceof Error ? e.message : 'Could not load the college data.');
      });
    return () => {
      live = false;
    };
  }, [exam]);

  const fields = useMemo(() => rankFields(exam, category, pwd, homeState), [exam, category, pwd, homeState]);

  const yearOptions = useMemo(() => {
    if (!meta) return [];
    const pool = meta.bodies.filter((b) => !bodies.length || bodies.includes(b.body));
    return [...new Set(pool.flatMap((b) => b.years.map((y) => y.year)))].sort((a, b) => b - a);
  }, [meta, bodies]);

  const buildQuery = useCallback((): Query | null => {
    const errors: Partial<Record<RankKey | 'ranks', string>> = {};
    const ranks: Query['ranks'] = {};
    for (const f of fields) {
      const text = rankText[f.key] ?? '';
      const parsed = parseRank(text);
      if (parsed === 'invalid') errors[f.key] = `Enter a whole number from 1 to ${MAX_RANK.toLocaleString('en-IN')}.`;
      else if (parsed !== null) ranks[f.key] = parsed;
      else if (predicted[f.key]) ranks[f.key] = predicted[f.key];
    }
    if (!Object.keys(errors).length && !Object.keys(ranks).length) errors.ranks = exam === 'neet' ? 'Enter your NEET rank.' : 'Enter at least one JEE rank.';
    setFieldErrors(errors);
    if (Object.keys(errors).length) return null;
    return {
      exam,
      ranks,
      category,
      pwd,
      gender,
      homeState,
      filters: {
        bodies,
        years: year ? [year] : [],
        instituteTypes: types,
        states: instState ? [instState] : [],
        branchQuery: branch.trim(),
        roundMode,
        band: 'all',
        sort,
      },
      page: 1,
      pageSize: PAGE_SIZE,
    };
  }, [fields, rankText, predicted, exam, category, pwd, gender, homeState, bodies, year, types, instState, branch, roundMode, sort]);

  const run = useCallback(async (query: Query, focusResults: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const res = await searchColleges(query);
      setResult(res);
      setLastQuery(query);
      if (focusResults) requestAnimationFrame(() => resultsRef.current?.focus());
    } catch (e: unknown) {
      setError(e instanceof Error && e.message ? e.message : 'Could not search. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const onSubmit = () => {
    const q = buildQuery();
    if (!q) return;
    // GA: the exam only (never ranks, category, gender or state — src/lib/analytics-events.ts).
    trackEvent('college_finder_search', { exam });
    setBand('all');
    void run(q, true);
  };

  // A predictor hand-off with ranks runs the first search by itself (it does not need the filter options).
  useEffect(() => {
    if (!handoffReady || autoRan.current) return;
    autoRan.current = true;
    const q = buildQuery();
    if (q) void run(q, false);
  }, [handoffReady, buildQuery, run]);

  const changePage = (page: number) => {
    if (!lastQuery) return;
    void run({ ...lastQuery, page, filters: { ...lastQuery.filters, band } }, true);
  };

  const changeBand = (next: ChanceBand | 'all') => {
    setBand(next);
    if (lastQuery) void run({ ...lastQuery, page: 1, filters: { ...lastQuery.filters, band: next } }, false);
  };

  const switchExam = (next: CounsellingExam) => {
    if (next === exam) return;
    setExam(next);
    setBodies([]);
    setYear('');
    setTypes([]);
    setInstState('');
    setResult(null);
    setLastQuery(null);
    setFieldErrors({});
  };

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const page = result?.page ?? 1;
  const pages = result ? Math.max(1, Math.ceil(result.total / (result.pageSize || PAGE_SIZE))) : 1;
  const first = result && result.total ? (page - 1) * result.pageSize + 1 : 0;
  const last = result ? Math.min(result.total, page * result.pageSize) : 0;
  const groups = result ? CHANCE_BANDS.map((b) => ({ band: b, rows: result.rows.filter((r) => r.band === b) })).filter((g) => g.rows.length) : [];
  const allCount = result ? result.counts.safe + result.counts.likely + result.counts.reach : 0;
  const usedSources = meta && result ? meta.bodies.filter((b) => result.searched.some((s) => s.body === b.body)) : [];
  const shownSources = (usedSources.length ? usedSources : (meta?.bodies ?? [])).filter((b) => b.sources.length);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pb-28 pt-6 sm:px-6">
      <Link href="/rank-predictor" className={`-ml-3 inline-flex h-12 w-fit items-center gap-2 rounded-full px-3 text-[14px] font-semibold text-foreground hover:bg-surface-2 ${fieldFocus}`}>
        <ArrowLeft aria-hidden className="size-4" /> Rank Predictor
      </Link>
      <header className="-mt-2 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-[34px] font-extrabold leading-none text-foreground">College finder</h1>
          <span className="rounded-full bg-primary/15 px-2.5 py-1 text-[12px] font-semibold uppercase tracking-wide text-foreground">Free</span>
        </div>
        <p className="text-[14px] text-muted-foreground">Which colleges your rank would have got in past years, round by round.</p>
      </header>

      <div role="tablist" aria-label="Exam" className="grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1">
        {(['jee', 'neet'] as const).map((id) => (
          <button
            key={id}
            role="tab"
            type="button"
            id={`${ids}-tab-${id}`}
            aria-selected={exam === id}
            aria-controls={`${ids}-panel`}
            tabIndex={exam === id ? 0 : -1}
            onClick={() => switchExam(id)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const other = id === 'jee' ? 'neet' : 'jee';
                switchExam(other);
                document.getElementById(`${ids}-tab-${other}`)?.focus();
              }
            }}
            className={`min-h-12 cursor-pointer rounded-full px-2 text-[14px] font-semibold transition-colors ${fieldFocus} ${
              exam === id ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-surface-3'
            }`}
          >
            {id === 'jee' ? 'JEE (JoSAA, CSAB)' : 'NEET (MCC, state)'}
          </button>
        ))}
      </div>

      <form
        id={`${ids}-panel`}
        role="tabpanel"
        aria-labelledby={`${ids}-tab-${exam}`}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="flex flex-col gap-5"
      >
        <fieldset className="flex flex-col gap-4 rounded-[18px] border border-border bg-card p-4 sm:p-6">
          <legend className="float-left w-full font-display text-[21px] font-bold text-foreground">Your rank</legend>
          {Object.keys(predicted).length ? (
            <p className="flex items-start gap-2 rounded-[12px] bg-surface-2 px-4 py-3 text-[13px] text-muted-foreground">
              <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>Filled from your Rank Predictor result. We check the whole predicted range: Safe uses its worst end, Reach its best end. Type a rank to use that instead.</span>
            </p>
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {fields.map((f) => {
              const inputId = `${ids}-${f.key}`;
              const err = fieldErrors[f.key];
              const pred = predicted[f.key];
              const describedBy = [f.hint || pred ? `${inputId}-hint` : '', err ? `${inputId}-err` : ''].filter(Boolean).join(' ') || undefined;
              return (
                <div key={f.key} className="flex flex-col gap-1">
                  <label htmlFor={inputId} className="text-[14px] font-medium text-foreground">
                    {f.label}
                  </label>
                  <input
                    id={inputId}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={rankText[f.key] ?? ''}
                    placeholder={pred ? `${formatRank(pred.low)} – ${formatRank(pred.high)}` : ''}
                    onChange={(e) => setRankText((t) => ({ ...t, [f.key]: e.target.value }))}
                    aria-invalid={err ? true : undefined}
                    aria-describedby={describedBy}
                    className={`h-12 w-full min-w-0 rounded-[12px] border bg-background px-3 text-[16px] tabular-nums text-foreground placeholder:text-muted-foreground ${fieldFocus} ${
                      err ? 'border-destructive' : 'border-border'
                    }`}
                  />
                  {f.hint || pred ? (
                    <span id={`${inputId}-hint`} className="text-[12px] text-muted-foreground">
                      {pred ? `Predicted ${formatRank(pred.low)} – ${formatRank(pred.high)}. ` : ''}
                      {f.hint ?? ''}
                    </span>
                  ) : null}
                  {err ? (
                    <span id={`${inputId}-err`} role="alert" className="text-[13px] font-medium text-destructive">
                      {err}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
          {fieldErrors.ranks ? (
            <p role="alert" className="text-[13px] font-medium text-destructive">
              {fieldErrors.ranks}
            </p>
          ) : null}
        </fieldset>

        <fieldset className="flex flex-col gap-4 rounded-[18px] border border-border bg-card p-4 sm:p-6">
          <legend className="float-left w-full font-display text-[21px] font-bold text-foreground">About you</legend>
          <div role="radiogroup" aria-labelledby={`${ids}-cat`} className="flex flex-col gap-2">
            <span id={`${ids}-cat`} className="text-[14px] font-medium text-foreground">
              Category
            </span>
            <div className="flex flex-wrap gap-2">
              {COUNSELLING_CATEGORIES.map((c) => (
                <Chip key={c} role="radio" selected={category === c} onClick={() => setCategory(c)}>
                  {CATEGORY_SEAT_LABEL[c]}
                </Chip>
              ))}
            </div>
          </div>
          <div role="radiogroup" aria-labelledby={`${ids}-gender`} className="flex flex-col gap-2">
            <span id={`${ids}-gender`} className="text-[14px] font-medium text-foreground">
              Gender <span className="font-normal text-muted-foreground">(female students are also checked for female-only seats)</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {(['male', 'female', 'other'] as const).map((g) => (
                <Chip key={g} role="radio" selected={gender === g} onClick={() => setGender(g)}>
                  {g === 'male' ? 'Male' : g === 'female' ? 'Female' : 'Other'}
                </Chip>
              ))}
            </div>
          </div>
          <label className="flex min-h-12 cursor-pointer items-center gap-3 text-[14px] font-medium text-foreground">
            <input type="checkbox" checked={pwd} onChange={(e) => setPwd(e.target.checked)} className={`size-6 shrink-0 accent-primary ${fieldFocus}`} />I am a PwD (PwBD) candidate
          </label>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${ids}-home`} className="text-[14px] font-medium text-foreground">
              Home state <span className="font-normal text-muted-foreground">(for home-state and state quota seats)</span>
            </label>
            <select
              id={`${ids}-home`}
              value={homeState}
              onChange={(e) => setHomeState(e.target.value)}
              className={`h-12 w-full rounded-[12px] border border-border bg-background px-3 text-[16px] text-foreground ${fieldFocus}`}
            >
              <option value="">Not selected</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <p className="text-[13px] text-muted-foreground">We use these details only for this search. They are never saved on our servers.</p>
        </fieldset>

        <details className="group rounded-[18px] border border-border bg-card">
          <summary className={`flex min-h-14 cursor-pointer list-none items-center justify-between gap-2 rounded-[18px] px-4 font-display text-[18px] font-bold text-foreground sm:px-6 ${fieldFocus}`}>
            Filters
            <span className="flex items-center gap-2 text-[13px] font-normal text-muted-foreground">
              {[bodies.length, year ? 1 : 0, types.length, instState ? 1 : 0, branch.trim() ? 1 : 0].reduce((a, b) => a + b, 0) || 'None'} set
              <ChevronDown aria-hidden className="size-5 transition-transform group-open:rotate-180" />
            </span>
          </summary>
          <div className="flex flex-col gap-5 px-4 pb-5 sm:px-6">
            {metaError ? (
              <p role="alert" className="text-[13px] text-destructive">
                {metaError}
              </p>
            ) : null}
            <div className="flex flex-col gap-2">
              <span id={`${ids}-bodies`} className="text-[14px] font-medium text-foreground">
                Counselling <span className="font-normal text-muted-foreground">(none picked = {exam === 'jee' ? 'JoSAA + CSAB' : 'MCC + your state'})</span>
              </span>
              <div role="group" aria-labelledby={`${ids}-bodies`} className="flex flex-wrap gap-2">
                {(meta?.bodies ?? []).map((b) => (
                  <Chip key={b.body} selected={bodies.includes(b.body)} onClick={() => setBodies((l) => toggle(l, b.body))}>
                    {b.label}
                  </Chip>
                ))}
              </div>
              {(meta?.bodies ?? [])
                .filter((b) => b.note && (bodies.includes(b.body) || (!bodies.length && STATE_BODY_BY_STATE[homeState] === b.body)))
                .map((b) => (
                  <p key={b.body} className="text-[12px] text-muted-foreground">
                    {b.label}: {b.note}
                  </p>
                ))}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label htmlFor={`${ids}-year`} className="text-[14px] font-medium text-foreground">
                  Year
                </label>
                <select
                  id={`${ids}-year`}
                  value={year}
                  onChange={(e) => setYear(e.target.value ? Number(e.target.value) : '')}
                  className={`h-12 rounded-[12px] border border-border bg-background px-3 text-[16px] text-foreground ${fieldFocus}`}
                >
                  <option value="">Latest year</option>
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={`${ids}-state`} className="text-[14px] font-medium text-foreground">
                  College in state
                </label>
                <select
                  id={`${ids}-state`}
                  value={instState}
                  onChange={(e) => setInstState(e.target.value)}
                  className={`h-12 rounded-[12px] border border-border bg-background px-3 text-[16px] text-foreground ${fieldFocus}`}
                >
                  <option value="">Any state</option>
                  {(meta?.states ?? []).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span id={`${ids}-types`} className="text-[14px] font-medium text-foreground">
                Institute type
              </span>
              <div role="group" aria-labelledby={`${ids}-types`} className="flex flex-wrap gap-2">
                {(meta?.instituteTypes ?? []).map((t) => (
                  <Chip key={t} selected={types.includes(t)} onClick={() => setTypes((l) => toggle(l, t))}>
                    {INSTITUTE_TYPE_LABEL[t]}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={`${ids}-branch`} className="text-[14px] font-medium text-foreground">
                Branch or college name
              </label>
              <div className="relative">
                <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id={`${ids}-branch`}
                  type="search"
                  maxLength={60}
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder={exam === 'jee' ? 'e.g. Computer Science, Electrical' : 'e.g. MBBS, BDS, AIIMS'}
                  className={`h-12 w-full rounded-[12px] border border-border bg-background pl-9 pr-3 text-[16px] text-foreground placeholder:text-muted-foreground ${fieldFocus}`}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div role="radiogroup" aria-labelledby={`${ids}-rounds`} className="flex flex-col gap-2">
                <span id={`${ids}-rounds`} className="text-[14px] font-medium text-foreground">
                  Rounds to show
                </span>
                <div className="flex flex-wrap gap-2">
                  <Chip role="radio" selected={roundMode === 'each'} onClick={() => setRoundMode('each')}>
                    Every round
                  </Chip>
                  <Chip role="radio" selected={roundMode === 'final'} onClick={() => setRoundMode('final')}>
                    Last round only
                  </Chip>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={`${ids}-sort`} className="text-[14px] font-medium text-foreground">
                  Sort inside each group
                </label>
                <select
                  id={`${ids}-sort`}
                  value={sort}
                  onChange={(e) => setSort(e.target.value as 'competitive' | 'closest')}
                  className={`h-12 rounded-[12px] border border-border bg-background px-3 text-[16px] text-foreground ${fieldFocus}`}
                >
                  <option value="competitive">Most sought-after first</option>
                  <option value="closest">Closest to my rank first</option>
                </select>
              </div>
            </div>
          </div>
        </details>

        <button
          type="submit"
          disabled={loading}
          aria-busy={loading}
          className={`inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-6 text-[16px] font-semibold text-primary-foreground disabled:opacity-70 ${fieldFocus}`}
        >
          {loading ? <Loader2 aria-hidden className="size-5 motion-safe:animate-spin" /> : <Search aria-hidden className="size-5" />}
          {loading ? 'Finding colleges…' : 'Find colleges'}
        </button>
      </form>

      {error ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-[18px] border border-border bg-card p-4">
          <p className="text-[14px] text-foreground">{error}</p>
          <button
            type="button"
            onClick={() => (lastQuery ? void run(lastQuery, false) : onSubmit())}
            className={`inline-flex h-12 cursor-pointer items-center gap-2 rounded-full border border-border px-5 text-[14px] font-semibold text-foreground hover:bg-surface-2 ${fieldFocus}`}
          >
            <RotateCcw aria-hidden className="size-4" /> Try again
          </button>
        </div>
      ) : null}

      <div ref={resultsRef} tabIndex={-1} aria-live="polite" aria-busy={loading} className="flex flex-col gap-4 outline-none">
        {result ? (
          <>
            <h2 className="font-display text-[21px] font-bold text-foreground">
              {allCount ? `${allCount.toLocaleString('en-IN')} seat options` : 'No seats matched'}
              <span className="block text-[13px] font-normal text-muted-foreground">
                {result.searched.map((s) => `${s.label} ${s.year}`).join(' · ') || 'No data for this choice'}
              </span>
            </h2>

            {allCount ? (
              <div role="tablist" aria-label="Chance" className="grid grid-cols-4 gap-1 rounded-[14px] bg-surface-2 p-1">
                {(['all', ...CHANCE_BANDS] as const).map((b) => {
                  const n = b === 'all' ? allCount : result.counts[b];
                  const Icon = b === 'all' ? null : BAND_ICON[b];
                  return (
                    <button
                      key={b}
                      type="button"
                      role="tab"
                      aria-selected={band === b}
                      onClick={() => changeBand(b)}
                      className={`flex min-h-12 cursor-pointer flex-col items-center justify-center rounded-[10px] px-1 text-[13px] font-semibold ${fieldFocus} ${
                        band === b ? 'bg-card text-foreground shadow-sm ring-2 ring-primary' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {Icon ? <Icon aria-hidden className="size-3.5" /> : null}
                        {b === 'all' ? 'All' : BAND_LABEL[b]}
                      </span>
                      <span className="tabular-nums">{n.toLocaleString('en-IN')}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {result.missingRanks.length ? (
              <p className="flex items-start gap-2 rounded-[12px] bg-surface-2 px-4 py-3 text-[13px] text-foreground">
                <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
                <span>Add your {result.missingRanks.join(', ')} to see the seats that use {result.missingRanks.length > 1 ? 'them' : 'it'}.</span>
              </p>
            ) : null}

            {!allCount ? (
              <div className="rounded-[18px] border border-border bg-card p-4 text-[14px] text-foreground">
                <p className="font-semibold">Nothing within reach for these filters.</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-muted-foreground">
                  <li>Clear the institute type, state or branch filters.</li>
                  <li>Add your home state: home-state seats often close at a later rank.</li>
                  <li>{exam === 'jee' ? 'Add your category rank if you have a category certificate.' : 'Pick another year: closing ranks move a little every year.'}</li>
                </ul>
              </div>
            ) : (
              groups.map((g) => (
                <section key={g.band} aria-labelledby={`${ids}-g-${g.band}`} className="flex flex-col gap-3">
                  <div className="flex flex-col gap-0.5">
                    <h3 id={`${ids}-g-${g.band}`} className="inline-flex items-center gap-2 text-[16px] font-bold text-foreground">
                      <span className={`inline-flex size-7 items-center justify-center rounded-full ${BAND_STYLE[g.band]}`}>
                        {(() => {
                          const Icon = BAND_ICON[g.band];
                          return <Icon aria-hidden className="size-4" />;
                        })()}
                      </span>
                      {BAND_LABEL[g.band]} <span className="font-normal text-muted-foreground">({result.counts[g.band].toLocaleString('en-IN')})</span>
                    </h3>
                    <p className="text-[13px] text-muted-foreground">{BAND_HINT[g.band]}</p>
                  </div>
                  <ul className="flex flex-col gap-3">
                    {g.rows.map((row) => (
                      <ResultRow key={row.key} row={row} />
                    ))}
                  </ul>
                </section>
              ))
            )}

            {result.total > result.pageSize ? (
              <nav aria-label="Pages" className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => changePage(page - 1)}
                  className={`inline-flex h-12 cursor-pointer items-center gap-1 rounded-full border border-border px-4 text-[14px] font-semibold text-foreground hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50 ${fieldFocus}`}
                >
                  <ChevronLeft aria-hidden className="size-4" /> Previous
                </button>
                <span className="text-[13px] tabular-nums text-muted-foreground">
                  {first.toLocaleString('en-IN')}–{last.toLocaleString('en-IN')} of {result.total.toLocaleString('en-IN')}
                </span>
                <button
                  type="button"
                  disabled={page >= pages || loading}
                  onClick={() => changePage(page + 1)}
                  className={`inline-flex h-12 cursor-pointer items-center gap-1 rounded-full border border-border px-4 text-[14px] font-semibold text-foreground hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50 ${fieldFocus}`}
                >
                  Next <ChevronRight aria-hidden className="size-4" />
                </button>
              </nav>
            ) : null}

            {result.notes.length ? (
              <ul className="list-disc space-y-1 pl-5 text-[13px] text-muted-foreground">
                {result.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            ) : null}
            {usedSources.some((b) => BODY_DATA_NOTE[b.body]) ? (
              <ul className="list-disc space-y-1 pl-5 text-[13px] text-muted-foreground">
                {usedSources
                  .filter((b) => BODY_DATA_NOTE[b.body])
                  .map((b) => (
                    <li key={b.body}>
                      {b.label}: {BODY_DATA_NOTE[b.body]}
                    </li>
                  ))}
              </ul>
            ) : null}
          </>
        ) : loading ? (
          <ul aria-hidden className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-40 rounded-[18px] bg-surface-2 motion-safe:animate-pulse" />
            ))}
          </ul>
        ) : null}
      </div>

      {/* Sources, data date, disclaimer and official links: always on the page (plan §11.4, §12.2). */}
      <footer className="flex flex-col gap-2 rounded-[18px] bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
        <p className="font-semibold text-foreground">{meta?.disclaimer ?? 'Based on last year’s closing ranks; this year will differ.'}</p>
        {shownSources.length ? (
          <p>
            <span className="font-semibold text-foreground">Data: </span>
            {shownSources.map((b, i) => (
              <span key={b.body}>
                {i > 0 ? ' · ' : ''}
                <a
                  href={b.sources[0].url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
                >
                  {b.label}
                  {b.sources[0].official ? ' (official)' : ''}
                </a>
              </span>
            ))}
            {meta?.checkedOn ? ` · checked ${meta.checkedOn}` : ''}
          </p>
        ) : null}
        <p className="flex flex-wrap items-center gap-x-3">
          <span>Official sites:</span>
          {(meta?.officialLinks ?? []).map((l) => (
            <a
              key={l.url}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center gap-0.5 font-semibold text-foreground underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-primary"
            >
              {l.label}
              <ExternalLink aria-hidden className="size-3" />
            </a>
          ))}
        </p>
      </footer>
    </main>
  );
}
