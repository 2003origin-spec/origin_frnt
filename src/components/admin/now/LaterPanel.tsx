'use client';

/**
 * Ask later (decision B94): every written-answer doubt by status. A report
 * about an answer is a case in Reports; closing it settles the coins here
 * (upheld → student refunded, dismissed → solver paid).
 */

import { useState } from 'react';

import { fmtDate, useAdminData } from './admin-now-api';
import { ErrorLine, Section, Table, Td, buttonClass, ghostButtonClass } from './ui';

type Item = {
  id: string;
  subject: string;
  chapter: string | null;
  difficulty: string;
  question: { text: string };
  note: string | null;
  priceCoins: number;
  status: string;
  answer: { text: string; at: string } | null;
  stars: number | null;
  tipCoins: number;
  expiresAt: string;
  createdAt: string;
  studentName: string | null;
  solverName: string | null;
  settleOutcome: string | null;
};

const STATUSES = ['', 'open', 'claimed', 'answered', 'disputed', 'accepted', 'expired', 'cancelled'];

export function LaterPanel() {
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const data = useAdminData<{ items: Item[] }>(`/later${status ? `?status=${status}` : ''}`);
  return (
    <Section title="Ask later">
      <div className="mb-3 flex flex-wrap gap-2 text-sm" role="tablist" aria-label="Ask later status">
        {STATUSES.map((s) => (
          <button key={s || 'all'} role="tab" aria-selected={status === s} className={status === s ? buttonClass : ghostButtonClass} onClick={() => setStatus(s)}>
            {s ? s[0].toUpperCase() + s.slice(1) : 'All'}
          </button>
        ))}
      </div>
      <ErrorLine error={data.error} />
      <Table head={['Asked', 'Doubt', 'Student → solver', 'Coins', 'Status', '']} empty={(data.data?.items.length ?? 0) === 0}>
        {(data.data?.items ?? []).map((i) => (
          <tr key={i.id}>
            <Td className="whitespace-nowrap">{fmtDate(i.createdAt)}</Td>
            <Td><span className="capitalize">{i.subject}</span> · {i.chapter ?? '—'} · <span className="capitalize">{i.difficulty}</span></Td>
            <Td>{i.studentName} → {i.solverName ?? '—'}</Td>
            <Td>{i.priceCoins}{i.tipCoins ? ` + tip ${i.tipCoins}` : ''}</Td>
            <Td>
              {i.status}
              {i.stars ? ` · ${i.stars}★` : ''}
              {i.settleOutcome ? ` · ${i.settleOutcome}` : ''}
            </Td>
            <Td>
              <button className={ghostButtonClass} onClick={() => setOpen(open === i.id ? null : i.id)}>
                {open === i.id ? 'Hide' : 'Read'}
              </button>
              {open === i.id && (
                <div className="mt-2 max-w-xl whitespace-pre-wrap rounded-md bg-muted p-2 text-xs">
                  <p className="font-medium">Question</p>
                  <p>{i.question.text}</p>
                  {i.note && (
                    <>
                      <p className="mt-2 font-medium">Student&apos;s note</p>
                      <p>{i.note}</p>
                    </>
                  )}
                  {i.answer && (
                    <>
                      <p className="mt-2 font-medium">Answer ({fmtDate(i.answer.at)})</p>
                      <p>{i.answer.text}</p>
                    </>
                  )}
                </div>
              )}
            </Td>
          </tr>
        ))}
      </Table>
      <p className="mt-2 text-xs text-muted-foreground">
        Reports about an answer are in the Reports tab; closing the case settles the coins. Unanswered doubts are refunded at their deadline;
        answers left without a response are accepted after 48 hours.
      </p>
    </Section>
  );
}
