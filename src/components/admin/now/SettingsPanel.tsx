'use client';

/** Admin controls (plan doc "Admin controls"): settings, price table, coin packs. */

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { adminSend, useAdminData } from './admin-now-api';
import { ErrorLine, LegalNote, Section, Table, Td, buttonClass, ghostButtonClass, inputClass } from './ui';

type Settings = {
  welcomeCoins: number;
  commissionBps: number;
  tipCap: number;
  openHours: { from: string; to: string; days: number[] };
  bot: { enabled: boolean; whenNoneOnline: boolean; afterFailedOffers: number | null; afterMs: number | null; disabledSubjects: string[] };
  transfers: { enabled: boolean; dailyCap: number; minAccountAgeDays: number; kycRequired: boolean };
  quiz: { questions: number; minutes: number; passPercent: number };
  agreementVersion: string;
  recordingRetentionDays: number;
  eveningBonus: { enabled: boolean; coins: number; minOnlinePercent: number; requireRoster: boolean };
};
type PriceRow = {
  difficulty: string;
  solverKind: string;
  priceCoins: number;
  minutes: number;
  extensionMinutes: number;
  extensionCoins: number;
  maxExtensions: number;
};
type Pack = { id: string; name: string; coins: number; pricePaise: number; active: boolean; sortOrder: number };

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SUBJECTS = ['physics', 'chemistry', 'mathematics', 'biology'];

function NumberField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input type="number" step={step} className={inputClass} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

/** What the legal team signs off before the flag goes on (decision B78). Engineering does not decide these. */
const LEGAL_SIGN_OFFS = [
  'Helper Agreement: the approved text replaces the summary in the solver application (step 5), then raise the version below.',
  'Guardian consent: the wording of the consent email and the /now/consent page.',
  "Children's safety: the reports procedure, including the same-day POCSO police report, and who the Grievance Officer is.",
  'Call recording: the notice shown to both sides and how long recordings are kept.',
  'Solver KYC: what is collected (masked Aadhaar, selfie, qualification; PAN optional) and how long it is kept.',
  'Ori Coins: purchased coins not refundable, no cash-out, store purchases final, coin transfers between users kept off.',
  'Solver earnings in coins and store items: tax treatment (with the CA).',
];

function LegalChecklist() {
  return (
    <Section title="Before the pilot: legal team sign-off">
      <p className="mb-2 text-sm text-muted-foreground">
        The legal team owns these. Configure the matching settings here only after they confirm each one.
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {LEGAL_SIGN_OFFS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </Section>
  );
}

function SettingsForm() {
  const { data, error, setData } = useAdminData<{ settings: Settings }>('/settings');
  const [draft, setDraft] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data) setDraft(data.settings);
  }, [data]);
  if (!draft) return <ErrorLine error={error} />;
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setDraft({ ...draft, [key]: value });

  const save = async () => {
    setBusy(true);
    try {
      const res = await adminSend<{ settings: Settings }>('/settings', 'PUT', draft);
      setData(res);
      toast.success('Settings saved.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Settings" actions={<button className={buttonClass} onClick={save} disabled={busy}>Save settings</button>}>
      <div className="grid gap-4 md:grid-cols-3">
        <NumberField label="Welcome coins" value={draft.welcomeCoins} onChange={(v) => set('welcomeCoins', v)} />
        <NumberField label="Commission (basis points, 100 = 1%)" value={draft.commissionBps} onChange={(v) => set('commissionBps', v)} />
        <NumberField label="Tip cap (coins)" value={draft.tipCap} onChange={(v) => set('tipCap', v)} />
        <NumberField label="Recording kept (days)" value={draft.recordingRetentionDays} onChange={(v) => set('recordingRetentionDays', v)} />
        <label className="flex flex-col gap-1 text-sm">
          Helper Agreement version
          <input className={inputClass} value={draft.agreementVersion} onChange={(e) => set('agreementVersion', e.target.value)} />
        </label>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <LegalNote>
          change the Helper Agreement version only when the legal team approves new text. New applicants must accept the
          current version; solvers already approved keep the version they accepted.
        </LegalNote>
        <LegalNote>the recording period must match the recording notice the legal team approved (30 days by default).</LegalNote>
      </div>
      <h3 className="mb-2 mt-4 text-sm font-semibold">Human open hours (IST)</h3>
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          From
          <input type="time" className={inputClass} value={draft.openHours.from} onChange={(e) => set('openHours', { ...draft.openHours, from: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1">
          To
          <input type="time" className={inputClass} value={draft.openHours.to} onChange={(e) => set('openHours', { ...draft.openHours, to: e.target.value })} />
        </label>
        {DAYS.map((d, i) => (
          <label key={d} className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={draft.openHours.days.includes(i)}
              onChange={(e) =>
                set('openHours', {
                  ...draft.openHours,
                  days: e.target.checked ? [...draft.openHours.days, i].sort() : draft.openHours.days.filter((x) => x !== i),
                })
              }
            />
            {d}
          </label>
        ))}
      </div>
      <h3 className="mb-2 mt-4 text-sm font-semibold">Origin bot</h3>
      <div className="flex flex-wrap items-end gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={draft.bot.enabled} onChange={(e) => set('bot', { ...draft.bot, enabled: e.target.checked })} /> Bot on
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={draft.bot.whenNoneOnline} onChange={(e) => set('bot', { ...draft.bot, whenNoneOnline: e.target.checked })} /> At once when no human is online
        </label>
        <NumberField label="After N failed offers" value={draft.bot.afterFailedOffers ?? 0} onChange={(v) => set('bot', { ...draft.bot, afterFailedOffers: v > 0 ? v : null })} />
        <NumberField label="After waiting (seconds)" value={Math.round((draft.bot.afterMs ?? 0) / 1000)} onChange={(v) => set('bot', { ...draft.bot, afterMs: v > 0 ? v * 1000 : null })} />
        <span className="flex flex-wrap items-center gap-2">
          Off for:
          {SUBJECTS.map((s) => (
            <label key={s} className="flex items-center gap-1 capitalize">
              <input
                type="checkbox"
                checked={draft.bot.disabledSubjects.includes(s)}
                onChange={(e) =>
                  set('bot', {
                    ...draft.bot,
                    disabledSubjects: e.target.checked ? [...draft.bot.disabledSubjects, s] : draft.bot.disabledSubjects.filter((x) => x !== s),
                  })
                }
              />
              {s}
            </label>
          ))}
        </span>
      </div>
      <h3 className="mb-2 mt-4 text-sm font-semibold">Solver quiz</h3>
      <div className="grid gap-4 md:grid-cols-3">
        <NumberField label="Questions" value={draft.quiz.questions} onChange={(v) => set('quiz', { ...draft.quiz, questions: v })} />
        <NumberField label="Minutes" value={draft.quiz.minutes} onChange={(v) => set('quiz', { ...draft.quiz, minutes: v })} />
        <NumberField label="Pass mark (%)" value={draft.quiz.passPercent} onChange={(v) => set('quiz', { ...draft.quiz, passPercent: v })} />
      </div>
      <h3 className="mb-2 mt-4 text-sm font-semibold">Pilot evening bonus</h3>
      <div className="flex flex-wrap items-end gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={draft.eveningBonus.enabled}
            onChange={(e) => set('eveningBonus', { ...draft.eveningBonus, enabled: e.target.checked })}
          />{' '}
          Bonus on
        </label>
        <NumberField label="Coins per evening" value={draft.eveningBonus.coins} onChange={(v) => set('eveningBonus', { ...draft.eveningBonus, coins: v })} />
        <NumberField
          label="Online for at least (% of the shift)"
          value={draft.eveningBonus.minOnlinePercent}
          onChange={(v) => set('eveningBonus', { ...draft.eveningBonus, minOnlinePercent: v })}
        />
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={draft.eveningBonus.requireRoster}
            onChange={(e) => set('eveningBonus', { ...draft.eveningBonus, requireRoster: e.target.checked })}
          />{' '}
          Only evenings on the solver&apos;s roster
        </label>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Paid by the nightly job (2:00 am IST) for the evenings just ended, once per solver per evening, as spendable bonus coins.
        Off until the founders set an amount.
      </p>
      <p className="mt-4 text-xs text-muted-foreground">
        Coin transfers between users stay off in the pilot (legal team decision pending); they are not editable here.
      </p>
    </Section>
  );
}

function PriceTable() {
  const { data, error, setData } = useAdminData<{ rows: PriceRow[]; isDefault: boolean }>('/prices');
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data) setRows(data.rows);
  }, [data]);
  const update = (i: number, key: keyof PriceRow, value: number) => setRows(rows.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
  const save = async () => {
    setBusy(true);
    try {
      await adminSend('/prices', 'PUT', { rows });
      setData({ rows, isDefault: false });
      toast.success('Prices saved.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  };
  const num = (i: number, key: keyof PriceRow) => (
    <input type="number" className={`${inputClass} w-20`} value={rows[i][key] as number} onChange={(e) => update(i, key, Number(e.target.value))} />
  );
  return (
    <Section
      title={`Session prices${data?.isDefault ? ' (placeholders — not saved yet)' : ''}`}
      actions={<button className={buttonClass} onClick={save} disabled={busy}>Save prices</button>}
    >
      <ErrorLine error={error} />
      <Table head={['Difficulty', 'Solver', 'Coins', 'Minutes', 'Extra minutes', 'Extra coins', 'Max extensions']}>
        {rows.map((r, i) => (
          <tr key={`${r.difficulty}-${r.solverKind}`}>
            <Td className="capitalize">{r.difficulty}</Td>
            <Td>{r.solverKind}</Td>
            <Td>{num(i, 'priceCoins')}</Td>
            <Td>{num(i, 'minutes')}</Td>
            <Td>{num(i, 'extensionMinutes')}</Td>
            <Td>{num(i, 'extensionCoins')}</Td>
            <Td>{num(i, 'maxExtensions')}</Td>
          </tr>
        ))}
      </Table>
    </Section>
  );
}

function CoinPacks() {
  const { data, error, reload } = useAdminData<{ packs: Pack[] }>('/packs');
  const [name, setName] = useState('');
  const [coins, setCoins] = useState(500);
  const [rupees, setRupees] = useState(49);
  const save = async (pack: Partial<Pack> & { name: string; coins: number; pricePaise: number }) => {
    try {
      await adminSend('/packs', 'POST', pack);
      toast.success('Pack saved.');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed.');
    }
  };
  return (
    <Section title="Coin packs">
      <div className="mb-3">
        <LegalNote>
          pack names and prices go on sale only after the legal team confirms the coin terms shown to buyers (purchased
          coins are not refundable, coins never turn back into money).
        </LegalNote>
      </div>
      <ErrorLine error={error} />
      <Table head={['Pack', 'Coins', 'Price', 'On sale', '']} empty={(data?.packs.length ?? 0) === 0}>
        {(data?.packs ?? []).map((p) => (
          <tr key={p.id}>
            <Td>{p.name}</Td>
            <Td>{p.coins.toLocaleString('en-IN')}</Td>
            <Td>₹{(p.pricePaise / 100).toLocaleString('en-IN')}</Td>
            <Td>{p.active ? 'Yes' : 'No'}</Td>
            <Td>
              <button className={ghostButtonClass} onClick={() => save({ ...p, active: !p.active })}>
                {p.active ? 'Take off sale' : 'Put on sale'}
              </button>
            </Td>
          </tr>
        ))}
      </Table>
      <div className="mt-3 flex flex-wrap items-end gap-2 text-sm">
        <label className="flex flex-col gap-1">
          Name
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Starter pack" />
        </label>
        <NumberField label="Coins" value={coins} onChange={setCoins} />
        <NumberField label="Price (₹)" value={rupees} onChange={setRupees} step={0.01} />
        <button className={buttonClass} disabled={!name.trim()} onClick={() => save({ name: name.trim(), coins, pricePaise: Math.round(rupees * 100), active: false })}>
          Add pack (off sale)
        </button>
      </div>
    </Section>
  );
}

export function SettingsPanel() {
  return (
    <div className="flex flex-col gap-4">
      <LegalChecklist />
      <SettingsForm />
      <PriceTable />
      <CoinPacks />
    </div>
  );
}
