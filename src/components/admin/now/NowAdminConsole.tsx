'use client';

/**
 * Origin NOW admin console (build step 10; plan doc "Admin"). One page with a
 * tab per job, chosen by `?tab=` (and `?id=` for a session review), the same
 * query-string route shape as /now/room and /now/consent (decision B53).
 */

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { ApplicationsPanel } from './ApplicationsPanel';
import { GroupsPanel } from './GroupsPanel';
import { LaterPanel } from './LaterPanel';
import { OverviewPanel } from './OverviewPanel';
import { PeoplePanel } from './PeoplePanel';
import { ReadinessPanel } from './ReadinessPanel';
import { ReportsPanel } from './ReportsPanel';
import { RosterPanel } from './RosterPanel';
import { ScorecardPanel } from './ScorecardPanel';
import { SessionsPanel } from './SessionsPanel';
import { SettingsPanel } from './SettingsPanel';
import { SolversPanel } from './SolversPanel';
import { StorePanel } from './StorePanel';

const TABS = [
  { id: 'overview', label: 'Live monitor' },
  { id: 'readiness', label: 'Launch check' },
  { id: 'reports', label: 'Reports' },
  { id: 'applications', label: 'Applications' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'later', label: 'Ask later' },
  { id: 'groups', label: 'Group sessions' },
  { id: 'roster', label: 'Roster' },
  { id: 'solvers', label: 'Solvers & metrics' },
  { id: 'scorecard', label: 'Pilot scorecard' },
  { id: 'people', label: 'People, cohort & wallets' },
  { id: 'store', label: 'Store' },
  { id: 'settings', label: 'Settings & prices' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function NowAdminConsole() {
  const params = useSearchParams();
  const requested = params.get('tab') ?? 'overview';
  const tab: TabId = (TABS.some((t) => t.id === requested) ? requested : 'overview') as TabId;
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold">Origin NOW</h1>
        <p className="text-sm text-muted-foreground">Live doubt help pilot: monitor, safety queues, solvers, coins and settings.</p>
      </header>
      <nav className="flex flex-wrap gap-1 border-b pb-2" aria-label="Origin NOW admin sections">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/admin/now?tab=${t.id}`}
            aria-current={t.id === tab ? 'page' : undefined}
            className={`rounded-md px-3 py-1 text-sm ${t.id === tab ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {tab === 'overview' && <OverviewPanel />}
      {tab === 'readiness' && <ReadinessPanel />}
      {tab === 'reports' && <ReportsPanel />}
      {tab === 'applications' && <ApplicationsPanel />}
      {tab === 'sessions' && <SessionsPanel sessionId={params.get('id')} />}
      {tab === 'later' && <LaterPanel />}
      {tab === 'groups' && <GroupsPanel />}
      {tab === 'roster' && <RosterPanel />}
      {tab === 'solvers' && <SolversPanel />}
      {tab === 'scorecard' && <ScorecardPanel />}
      {tab === 'people' && <PeoplePanel />}
      {tab === 'store' && <StorePanel />}
      {tab === 'settings' && <SettingsPanel />}
    </div>
  );
}
