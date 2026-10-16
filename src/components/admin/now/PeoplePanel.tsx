'use client';

/** People: search, pilot cohort, wallet lookup with credits, and read-only dashboards (plan doc "Admin view"). */

import { useState } from 'react';
import { toast } from 'sonner';

import { adminSend, adminGet, fmtDate, pct, useAdminData } from './admin-now-api';
import { ErrorLine, Section, Stat, Table, Td, buttonClass, ghostButtonClass, inputClass } from './ui';

type Person = { id: string; name: string | null; email: string | null; role: string; hasDateOfBirth: boolean; inCohort: boolean; helperId: string | null; helperStatus: string | null };
type Wallet = {
  frozen: boolean;
  balance: { available: number; pending: number };
  movements: { transferId: string; kind: string; direction: string; amount: number; createdAt: string; availableAt: string | null }[];
};
type Dashboards = {
  student: { summary: Record<string, number>; history: { requestId: string; subject: string; status: string; solverName: string | null; outcome: string | null; stars: number | null; createdAt: string | null }[] } | null;
  solver: { summary: Record<string, number | null>; earnings: { balance: number; pending: number }; standing: { warnings: { detail: string }[] } } | null;
};
type Member = { userId: string; name: string | null; email: string | null; invitedAt: string; removedAt: string | null };

type Suspension = { id: string; scope: string; reason: string; startsAt: string; endsAt: string | null; liftedAt: string | null; active: boolean };

function Pauses({ userId }: { userId: string }) {
  const { data, reload } = useAdminData<{ suspensions: Suspension[] }>(`/suspensions?userId=${encodeURIComponent(userId)}`);
  const list = data?.suspensions ?? [];
  if (list.length === 0) return null;
  const lift = async (id: string) => {
    try {
      await adminSend(`/suspensions/${id}/lift`, 'POST');
      toast.success('Pause lifted.');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed.');
    }
  };
  return (
    <>
      <h3 className="mb-1 mt-4 text-sm font-semibold">Pauses</h3>
      <Table head={['Who', 'Why', 'From', 'Until', '']}>
        {list.map((s) => (
          <tr key={s.id}>
            <Td>{s.scope}</Td>
            <Td>{s.reason}</Td>
            <Td>{fmtDate(s.startsAt)}</Td>
            <Td>{s.liftedAt ? `lifted ${fmtDate(s.liftedAt)}` : s.endsAt ? fmtDate(s.endsAt) : 'until reviewed'}</Td>
            <Td>
              {s.active && s.scope === 'student' && <button className={ghostButtonClass} onClick={() => lift(s.id)}>Lift</button>}
              {s.active && s.scope === 'solver' && <span className="text-xs text-muted-foreground">Reinstate under Solvers</span>}
            </Td>
          </tr>
        ))}
      </Table>
    </>
  );
}

function PersonView({ person, onChanged }: { person: Person; onChanged: () => void }) {
  const wallet = useAdminData<Wallet>(`/wallets/${person.id}`);
  const dashboards = useAdminData<Dashboards>(`/dashboards/${person.id}`);
  const [coins, setCoins] = useState(0);
  const [reason, setReason] = useState('');
  const credit = async () => {
    try {
      await adminSend(`/wallets/${person.id}/adjust`, 'POST', { coins, reason: reason.trim() });
      toast.success(`Credited ${coins} coins.`);
      setCoins(0);
      setReason('');
      await wallet.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed.');
    }
  };
  const [freezeReason, setFreezeReason] = useState('');
  const freeze = async (frozen: boolean) => {
    try {
      await adminSend(`/wallets/${person.id}/freeze`, 'POST', { frozen, reason: freezeReason.trim() });
      toast.success(frozen ? 'Wallet frozen.' : 'Wallet unfrozen.');
      setFreezeReason('');
      await wallet.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed.');
    }
  };
  const cohort = async (add: boolean) => {
    try {
      if (add) await adminSend('/cohort', 'POST', { identifiers: [person.id] });
      else await adminSend(`/cohort/${person.id}`, 'DELETE');
      toast.success(add ? 'Invited to the pilot.' : 'Removed from the pilot.');
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed.');
    }
  };
  const d = dashboards.data;
  return (
    <Section
      title={`${person.name ?? person.email} (${person.role})`}
      actions={
        <button className={ghostButtonClass} onClick={() => cohort(!person.inCohort)}>
          {person.inCohort ? 'Remove from pilot' : 'Invite to pilot'}
        </button>
      }
    >
      <p className="mb-3 text-xs text-muted-foreground">
        {person.email} · {person.inCohort ? 'in the pilot' : 'not in the pilot'} · {person.hasDateOfBirth ? 'date of birth on file' : 'NO date of birth (treated as a minor)'}
        {person.helperId ? ` · solver (${person.helperStatus})` : ''}
      </p>
      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="Coins available" value={wallet.data?.balance.available ?? '—'} />
        <Stat label="Coins pending" value={wallet.data?.balance.pending ?? '—'} />
        {d?.student && <Stat label="Doubts asked / solved" value={`${d.student.summary.asked} / ${d.student.summary.resolved}`} />}
        {d?.solver && <Stat label="Solved (all time)" value={d.solver.summary.solvedAllTime ?? 0} hint={`accept ${pct(d.solver.summary.acceptRate as number | null)}`} />}
      </div>
      {d?.solver?.standing.warnings.map((w, i) => <p key={i} className="mt-2 text-sm text-amber-700">{w.detail}</p>)}
      <Pauses userId={person.id} />
      {wallet.data && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className={wallet.data.frozen ? 'font-semibold text-red-700' : 'text-muted-foreground'}>
            Wallet {wallet.data.frozen ? 'FROZEN (cannot spend)' : 'active'}
          </span>
          <input className={`${inputClass} min-w-56 flex-1`} placeholder="Reason to freeze / unfreeze (logged)" value={freezeReason} onChange={(e) => setFreezeReason(e.target.value)} />
          <button className={ghostButtonClass} disabled={freezeReason.trim().length < 5} onClick={() => freeze(!wallet.data!.frozen)}>
            {wallet.data.frozen ? 'Unfreeze' : 'Freeze'}
          </button>
        </div>
      )}
      <h3 className="mb-1 mt-4 text-sm font-semibold">Credit coins (always a credit from Origin; logged with the reason)</h3>
      <div className="flex flex-wrap items-center gap-2">
        <input type="number" className={`${inputClass} w-28`} value={coins} onChange={(e) => setCoins(Math.max(0, Math.floor(Number(e.target.value))))} />
        <input className={`${inputClass} min-w-64 flex-1`} placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        <button className={buttonClass} disabled={coins <= 0 || reason.trim().length < 5} onClick={credit}>Credit</button>
      </div>
      <ErrorLine error={wallet.error} />
      <h3 className="mb-1 mt-4 text-sm font-semibold">Coin movements</h3>
      <Table head={['When', 'Kind', 'In / out', 'Coins', 'Spendable from']} empty={(wallet.data?.movements.length ?? 0) === 0}>
        {(wallet.data?.movements ?? []).slice(0, 50).map((m) => (
          <tr key={`${m.transferId}-${m.direction}`}>
            <Td>{fmtDate(m.createdAt)}</Td>
            <Td>{m.kind.replace('_', ' ')}</Td>
            <Td>{m.direction === 'credit' ? 'in' : 'out'}</Td>
            <Td>{m.amount}</Td>
            <Td>{m.availableAt ? fmtDate(m.availableAt) : 'now'}</Td>
          </tr>
        ))}
      </Table>
      {d?.student && d.student.history.length > 0 && (
        <>
          <h3 className="mb-1 mt-4 text-sm font-semibold">Their doubts (read-only)</h3>
          <Table head={['When', 'Subject', 'Solver', 'Status', 'Outcome', 'Rating']}>
            {d.student.history.map((h) => (
              <tr key={h.requestId}>
                <Td>{fmtDate(h.createdAt)}</Td>
                <Td className="capitalize">{h.subject}</Td>
                <Td>{h.solverName ?? '—'}</Td>
                <Td>{h.status}</Td>
                <Td>{h.outcome ?? '—'}</Td>
                <Td>{h.stars ? `${h.stars}★` : '—'}</Td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </Section>
  );
}

function Cohort() {
  const { data, error, reload } = useAdminData<{ members: Member[] }>('/cohort');
  const [text, setText] = useState('');
  const invite = async () => {
    try {
      const identifiers = text.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
      const result = await adminSend<{ invited: string[]; notFound: string[] }>('/cohort', 'POST', { identifiers });
      toast.success(`Invited ${result.invited.length}.${result.notFound.length ? ` Not found: ${result.notFound.join(', ')}` : ''}`);
      setText('');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed.');
    }
  };
  const active = (data?.members ?? []).filter((m) => !m.removedAt);
  return (
    <Section title={`Pilot cohort (${active.length})`}>
      <ErrorLine error={error} />
      <div className="mb-3 flex flex-wrap gap-2">
        <textarea className={`${inputClass} min-w-72 flex-1`} rows={2} placeholder="Emails or user ids, separated by commas or new lines" value={text} onChange={(e) => setText(e.target.value)} />
        <button className={buttonClass} disabled={!text.trim()} onClick={invite}>Invite</button>
      </div>
      <Table head={['Student', 'Invited']} empty={active.length === 0}>
        {active.slice(0, 200).map((m) => (
          <tr key={m.userId}><Td>{m.name} <span className="text-xs text-muted-foreground">{m.email}</span></Td><Td>{fmtDate(m.invitedAt)}</Td></tr>
        ))}
      </Table>
    </Section>
  );
}

export function PeoplePanel() {
  const [q, setQ] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [selected, setSelected] = useState<Person | null>(null);
  const [error, setError] = useState<string | null>(null);
  const search = async () => {
    try {
      const res = await adminGet<{ people: Person[] }>(`/people?q=${encodeURIComponent(q.trim())}`);
      setPeople(res.people);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed.');
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <Section title="Find a student or solver">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void search(); }}>
          <input className={`${inputClass} flex-1`} placeholder="Email, name or user id (3+ characters)" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className={buttonClass} disabled={q.trim().length < 3}>Search</button>
        </form>
        <ErrorLine error={error} />
        {people.length > 0 && (
          <ul className="mt-2 divide-y text-sm">
            {people.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-1">
                <span>{p.name} <span className="text-muted-foreground">{p.email}</span>{p.helperId ? ' · solver' : ''}{p.inCohort ? ' · pilot' : ''}</span>
                <button className={ghostButtonClass} onClick={() => setSelected(p)}>Open</button>
              </li>
            ))}
          </ul>
        )}
      </Section>
      {selected && (
        <PersonView
          key={selected.id}
          person={selected}
          onChanged={() => {
            setSelected({ ...selected, inCohort: !selected.inCohort });
          }}
        />
      )}
      <Cohort />
    </div>
  );
}
