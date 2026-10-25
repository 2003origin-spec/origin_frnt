'use client';

/**
 * Launch check (decision B86): everything that must be in place before the
 * Origin NOW flag goes on, read from the live system. Read-only; environment
 * variables show only as set / not set.
 */

import { fmtDate, useAdminData } from './admin-now-api';
import { ErrorLine, Section, Table, Td, ghostButtonClass } from './ui';

type Item = {
  key: string;
  group: 'Database' | 'Services' | 'Setup' | 'Switches';
  label: string;
  status: 'ok' | 'warn' | 'missing' | 'info';
  detail: string;
  fix?: string;
};
type Readiness = { checkedAt: string; ready: boolean; missing: number; warnings: number; items: Item[] };

const GROUPS: Item['group'][] = ['Database', 'Services', 'Setup', 'Switches'];

const STATUS: Record<Item['status'], { label: string; className: string }> = {
  ok: { label: 'Ready', className: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300' },
  warn: { label: 'Check', className: 'bg-amber-500/15 text-amber-800 dark:text-amber-300' },
  missing: { label: 'Missing', className: 'bg-red-500/15 text-red-800 dark:text-red-300' },
  info: { label: 'Info', className: 'bg-sky-500/15 text-sky-800 dark:text-sky-300' },
};

export function ReadinessPanel() {
  const { data, error, loading, reload } = useAdminData<Readiness>('/readiness');
  return (
    <div className="flex flex-col gap-4">
      <ErrorLine error={error} />
      {data && (
        <div
          className={`rounded-md border p-3 text-sm font-medium ${
            data.ready
              ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200'
              : 'border-red-500/60 bg-red-500/10 text-red-900 dark:text-red-200'
          }`}
        >
          {data.ready
            ? `Ready to switch on${data.warnings ? `, with ${data.warnings} thing${data.warnings === 1 ? '' : 's'} to check first` : ''}.`
            : `Not ready: ${data.missing} item${data.missing === 1 ? '' : 's'} missing${data.warnings ? ` and ${data.warnings} to check` : ''}.`}{' '}
          <span className="font-normal">Checked {fmtDate(data.checkedAt)}.</span>
        </div>
      )}
      {GROUPS.map((group) => {
        const items = (data?.items ?? []).filter((i) => i.group === group);
        if (data && items.length === 0) return null;
        return (
          <Section
            key={group}
            title={group}
            actions={
              group === 'Database' ? (
                <button className={ghostButtonClass} onClick={() => void reload()} disabled={loading}>
                  Check again
                </button>
              ) : undefined
            }
          >
            <Table head={['Item', 'Status', 'Found', 'What to do']}>
              {items.map((i) => (
                <tr key={i.key}>
                  <Td>{i.label}</Td>
                  <Td>
                    <span className={`whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${STATUS[i.status].className}`}>
                      {STATUS[i.status].label}
                    </span>
                  </Td>
                  <Td>{i.detail}</Td>
                  <Td className="text-xs text-muted-foreground">{i.status === 'ok' ? '' : (i.fix ?? '')}</Td>
                </tr>
              ))}
            </Table>
          </Section>
        );
      })}
    </div>
  );
}
