'use client';

/** Group sessions (decision B95): every session with its seats and outcome; cancel one (every seat refunded). */

import { toast } from 'sonner';

import { adminSend, fmtDate, useAdminData } from './admin-now-api';
import { ErrorLine, LegalNote, Section, Table, Td, ghostButtonClass } from './ui';

type Group = {
  id: string;
  subject: string;
  chapter: string;
  title: string;
  startsAt: string;
  minutes: number;
  seats: number;
  seatsTaken: number;
  priceCoins: number;
  status: string;
  solverName: string;
  settleOutcome: string | null;
  cancelReason: string | null;
};

export function GroupsPanel() {
  const data = useAdminData<{ groups: Group[] }>('/groups');
  const cancel = async (g: Group) => {
    const reason = window.prompt('Why is Origin cancelling this session? Every seat is refunded and students see the reason.');
    if (!reason) return;
    try {
      await adminSend(`/groups/${g.id}/cancel`, 'POST', { reason });
      toast.success('Cancelled; seats refunded.');
      await data.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed.');
    }
  };
  return (
    <Section title="Group sessions">
      <div className="mb-3">
        <LegalNote>group calls with several minors need the recording notice and safety procedure the legal team approved for 1:1 calls.</LegalNote>
      </div>
      <ErrorLine error={data.error} />
      <Table head={['Starts', 'Session', 'Solver', 'Seats', 'Status', '']} empty={(data.data?.groups.length ?? 0) === 0}>
        {(data.data?.groups ?? []).map((g) => (
          <tr key={g.id}>
            <Td className="whitespace-nowrap">{fmtDate(g.startsAt)}</Td>
            <Td>
              {g.title}
              <span className="block text-xs capitalize text-muted-foreground">{g.subject} · {g.chapter} · {g.minutes} min · {g.priceCoins} coins</span>
            </Td>
            <Td>{g.solverName}</Td>
            <Td>{g.seatsTaken}/{g.seats}</Td>
            <Td>
              {g.status}
              {g.settleOutcome ? ` · ${g.settleOutcome}` : ''}
              {g.cancelReason ? <span className="block text-xs text-muted-foreground">{g.cancelReason}</span> : null}
            </Td>
            <Td>{g.status === 'scheduled' && <button className={ghostButtonClass} onClick={() => cancel(g)}>Cancel</button>}</Td>
          </tr>
        ))}
      </Table>
      <p className="mt-2 text-xs text-muted-foreground">
        A solver more than 10 minutes late: every seat refunded. Paid per seat once a session ran at least half its length. Recordings follow the
        call retention. Reports about a session are in the Reports tab.
      </p>
    </Section>
  );
}
