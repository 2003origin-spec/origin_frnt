'use client';

/**
 * /admin/music — Study Music tracks (V1/STUDY_MUSIC_PLAN.md §4.7).
 *
 * Upload: pick a prepared .m4a/.mp3 (scripts/music-prepare.sh); the page reads
 * its length (an <audio> element) and SHA-256 (crypto.subtle) and pre-fills
 * them, then uploads the file straight to the private bucket with a presigned
 * PUT, optionally uploads the licence proof the same way, and creates a DRAFT.
 * Publish shows it to students; Retire takes it away everywhere (apps delete
 * their copy); Delete removes a draft or retired track and its files.
 * Data: /api/admin/music/* (admin role checked there on every call).
 */

import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';

import { mutateJson } from '@/lib/csrf';
import { formatISTDateTimeDMY } from '@/lib/format-time';
import {
  MUSIC_ARTIST_MAX,
  MUSIC_ATTRIBUTION_MAX,
  MUSIC_AUDIO_MAX_BYTES,
  MUSIC_DURATION_MAX_S,
  MUSIC_DURATION_MIN_S,
  MUSIC_LICENCE_PRESETS,
  MUSIC_MOODS,
  MUSIC_MOOD_LABELS,
  MUSIC_PROOF_MAX_BYTES,
  MUSIC_TITLE_MAX,
  parseTrackFields,
  parseTrackPatch,
  type MusicMood,
  type MusicTrackStatus,
} from '@/lib/study-music';

import { ErrorLine, Section, Stat, Table, Td, buttonClass, ghostButtonClass, inputClass } from '../now/ui';

const API = '/api/admin/music';
const OTHER_LICENCE = '__other__';

type Track = {
  id: string;
  title: string;
  artist: string;
  mood: MusicMood;
  durationSeconds: number;
  loopable: boolean;
  allowOffline: boolean;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  sourceUrl: string;
  licenceName: string;
  licenceUrl: string;
  attributionRequired: boolean;
  attributionText: string;
  hasProof: boolean;
  status: MusicTrackStatus;
  sortOrder: number;
  createdAt: string | null;
  publishedAt: string | null;
};
type ListResponse = { tracks: Track[]; storageBytes: number; studentsCanSee: boolean };
type Presigned = { uploadUrl: string; uploadHeaders: Record<string, string>; objectKey: string; uploadToken: string };

async function readError(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return (body as { detail?: string }).detail ?? `Request failed (${res.status})`;
}

async function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await mutateJson(`${API}${path}`, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as T;
}

function mb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function mmss(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The type the server accepts for a picked file (browsers report m4a as audio/x-m4a, audio/mp4 or nothing). */
function audioType(file: File): 'audio/mp4' | 'audio/mpeg' | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.m4a') || file.type === 'audio/mp4' || file.type === 'audio/x-m4a') return 'audio/mp4';
  if (name.endsWith('.mp3') || file.type === 'audio/mpeg' || file.type === 'audio/mp3') return 'audio/mpeg';
  return null;
}

function proofType(file: File): 'application/pdf' | 'image/png' | 'image/jpeg' | null {
  const name = file.name.toLowerCase();
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'application/pdf';
  if (file.type === 'image/png' || name.endsWith('.png')) return 'image/png';
  if (file.type === 'image/jpeg' || /\.jpe?g$/u.test(name)) return 'image/jpeg';
  return null;
}

async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function readDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This browser cannot read that file as audio.'));
    };
    audio.src = url;
  });
}

/** Presign, then PUT the same File with exactly the signed headers. */
async function uploadFile(kind: 'audio' | 'proof', file: File, contentType: string): Promise<Presigned> {
  const presigned = await send<Presigned>('/presign', 'POST', { kind, contentType, size: file.size, fileName: file.name });
  const put = await fetch(presigned.uploadUrl, { method: 'PUT', headers: presigned.uploadHeaders, body: file });
  if (!put.ok) throw new Error(`The ${kind === 'audio' ? 'audio' : 'proof'} upload was refused by storage (${put.status}).`);
  return presigned;
}

const STATUS_STYLE: Record<MusicTrackStatus, string> = {
  draft: 'border-amber-400/60 bg-amber-500/10 text-amber-900 dark:text-amber-200',
  published: 'border-emerald-500/60 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200',
  retired: 'border-zinc-400/60 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300',
};
const STATUS_LABEL: Record<MusicTrackStatus, string> = { draft: 'Draft', published: 'Published', retired: 'Retired' };

function StatusChip({ status }: { status: MusicTrackStatus }) {
  // Text, not colour alone, carries the state.
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>;
}

function Field({ label, hint, htmlFor, children, required }: { label: string; hint?: string; htmlFor: string; children: ReactNode; required?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required && <span aria-hidden="true" className="text-red-600"> *</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline underline-offset-2">
      {children}
    </a>
  );
}

// ── Upload form ──────────────────────────────────────────────────────────────

type FormState = {
  title: string;
  artist: string;
  mood: MusicMood;
  durationSeconds: string;
  loopable: boolean;
  allowOffline: boolean;
  sortOrder: string;
  licencePreset: string;
  licenceName: string;
  licenceUrl: string;
  sourceUrl: string;
  attributionRequired: boolean;
  attributionText: string;
};

const EMPTY_FORM: FormState = {
  title: '',
  artist: '',
  mood: 'lofi',
  durationSeconds: '',
  loopable: false,
  allowOffline: true,
  sortOrder: '0',
  licencePreset: MUSIC_LICENCE_PRESETS[0].name,
  licenceName: MUSIC_LICENCE_PRESETS[0].name,
  licenceUrl: MUSIC_LICENCE_PRESETS[0].url,
  sourceUrl: '',
  attributionRequired: MUSIC_LICENCE_PRESETS[0].attributionRequired,
  attributionText: '',
};

function suggestedCredit(form: FormState): string {
  if (!form.title.trim() || !form.artist.trim()) return '';
  return `‘${form.title.trim()}’ by ${form.artist.trim()}, ${form.licenceName.trim() || 'licence'}`;
}

function UploadForm({ onCreated }: { onCreated: () => void }) {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const proofRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sha, setSha] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [proof, setProof] = useState<File | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function pickFile(picked: File | null) {
    setError(null);
    setFile(null);
    setSha(null);
    if (!picked) return;
    if (!audioType(picked)) return setError('Pick an .m4a or .mp3 file (run scripts/music-prepare.sh first).');
    if (picked.size > MUSIC_AUDIO_MAX_BYTES) return setError(`That file is ${mb(picked.size)}; the limit is 15 MB.`);
    setReading(true);
    try {
      const [duration, hash] = await Promise.all([readDuration(picked), sha256Hex(picked)]);
      setFile(picked);
      setSha(hash);
      setForm((f) => ({
        ...f,
        durationSeconds: Number.isFinite(duration) ? String(Math.round(duration)) : f.durationSeconds,
        title: f.title || picked.name.replace(/\.[^.]+$/u, '').replace(/[-_]+/gu, ' ').trim().slice(0, MUSIC_TITLE_MAX),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the file.');
    } finally {
      setReading(false);
    }
  }

  function pickPreset(name: string) {
    const preset = MUSIC_LICENCE_PRESETS.find((p) => p.name === name);
    setForm((f) =>
      preset
        ? { ...f, licencePreset: name, licenceName: preset.name, licenceUrl: preset.url, attributionRequired: preset.attributionRequired }
        : { ...f, licencePreset: OTHER_LICENCE, licenceName: '', licenceUrl: '', attributionRequired: true },
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!file || !sha) return setError('Pick the audio file first.');
    const attributionText = form.attributionText.trim() || suggestedCredit(form);
    const fields = {
      title: form.title,
      artist: form.artist,
      mood: form.mood,
      durationSeconds: Number(form.durationSeconds),
      loopable: form.loopable,
      allowOffline: form.allowOffline,
      sortOrder: Number(form.sortOrder || '0'),
      sourceUrl: form.sourceUrl,
      licenceName: form.licenceName,
      licenceUrl: form.licenceUrl,
      attributionRequired: form.attributionRequired,
      attributionText,
    };
    // Same rules as the server, before anything is uploaded.
    const checked = parseTrackFields(fields);
    if (!checked.ok) return setError(checked.error);
    let proofType_: string | null = null;
    if (proof) {
      proofType_ = proofType(proof);
      if (!proofType_) return setError('Licence proof must be a PDF, PNG or JPEG.');
      if (proof.size > MUSIC_PROOF_MAX_BYTES) return setError('Licence proof must be 5 MB or less.');
    }
    try {
      setBusy('Uploading audio…');
      const audio = await uploadFile('audio', file, audioType(file)!);
      let proofFields = {};
      if (proof && proofType_) {
        setBusy('Uploading licence proof…');
        const p = await uploadFile('proof', proof, proofType_);
        proofFields = { proofKey: p.objectKey, proofToken: p.uploadToken };
      }
      setBusy('Checking the upload…');
      await send('/tracks', 'POST', { ...checked.value, objectKey: audio.objectKey, uploadToken: audio.uploadToken, sha256: sha, ...proofFields });
      toast.success('Track saved as a draft. Listen to it, then publish.');
      setForm(EMPTY_FORM);
      setFile(null);
      setSha(null);
      setProof(null);
      if (fileRef.current) fileRef.current.value = '';
      if (proofRef.current) proofRef.current.value = '';
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setBusy(null);
    }
  }

  const other = form.licencePreset === OTHER_LICENCE;
  return (
    <Section title="Add a track">
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <p className="text-sm text-muted-foreground">
          Only audio Origin may redistribute: CC0, CC BY 4.0, or made by us. Never YouTube, Spotify or Pixabay audio. Prepare the
          file first with <code className="rounded bg-muted px-1">scripts/music-prepare.sh</code> (AAC .m4a, about −16 LUFS).
        </p>
        <Field label="Audio file" htmlFor={`${id}-file`} required hint=".m4a or .mp3, 20 seconds to 20 minutes, up to 15 MB. Length and SHA-256 are read here.">
          <input
            ref={fileRef}
            id={`${id}-file`}
            type="file"
            accept=".m4a,.mp3,audio/mp4,audio/mpeg,audio/x-m4a"
            className="text-sm"
            onChange={(e) => void pickFile(e.target.files?.[0] ?? null)}
          />
        </Field>
        {reading && <p className="text-sm text-muted-foreground" aria-live="polite">Reading the file…</p>}
        {file && sha && (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {file.name} · {mb(file.size)} · SHA-256 <code className="break-all">{sha}</code>
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Title" htmlFor={`${id}-title`} required>
            <input id={`${id}-title`} className={inputClass} maxLength={MUSIC_TITLE_MAX} value={form.title} onChange={(e) => set('title', e.target.value)} />
          </Field>
          <Field label="Artist" htmlFor={`${id}-artist`} required hint="As the licence names them, e.g. HoliznaCC0, Kevin MacLeod, Origin.">
            <input id={`${id}-artist`} className={inputClass} maxLength={MUSIC_ARTIST_MAX} value={form.artist} onChange={(e) => set('artist', e.target.value)} />
          </Field>
          <Field label="Mood" htmlFor={`${id}-mood`} required>
            <select id={`${id}-mood`} className={inputClass} value={form.mood} onChange={(e) => set('mood', e.target.value as MusicMood)}>
              {MUSIC_MOODS.map((m) => (
                <option key={m} value={m}>
                  {MUSIC_MOOD_LABELS[m]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Length (seconds)" htmlFor={`${id}-duration`} required hint={`Filled in from the file. ${MUSIC_DURATION_MIN_S}–${MUSIC_DURATION_MAX_S} s.`}>
            <input
              id={`${id}-duration`}
              type="number"
              inputMode="numeric"
              min={MUSIC_DURATION_MIN_S}
              max={MUSIC_DURATION_MAX_S}
              className={inputClass}
              value={form.durationSeconds}
              onChange={(e) => set('durationSeconds', e.target.value)}
            />
          </Field>
          <Field label="Order in its mood" htmlFor={`${id}-order`} hint="Lower numbers play first.">
            <input id={`${id}-order`} type="number" inputMode="numeric" min={0} className={inputClass} value={form.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} />
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Playback</legend>
            <label className="flex min-h-[2rem] items-center gap-2 text-sm">
              <input type="checkbox" checked={form.loopable} onChange={(e) => set('loopable', e.target.checked)} />
              Loop it (nature and noise loops)
            </label>
            <label className="flex min-h-[2rem] items-center gap-2 text-sm">
              <input type="checkbox" checked={form.allowOffline} onChange={(e) => set('allowOffline', e.target.checked)} />
              Students may download it in the app
            </label>
          </fieldset>
        </div>

        <fieldset className="grid gap-4 rounded-lg border p-3 md:grid-cols-2">
          <legend className="px-1 text-sm font-semibold">Licence (every field is required to publish)</legend>
          <Field label="Licence" htmlFor={`${id}-licence`} required>
            <select id={`${id}-licence`} className={inputClass} value={form.licencePreset} onChange={(e) => pickPreset(e.target.value)}>
              {MUSIC_LICENCE_PRESETS.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
              <option value={OTHER_LICENCE}>Other…</option>
            </select>
          </Field>
          {other && (
            <Field label="Licence name" htmlFor={`${id}-licence-name`} required hint="Never NC, ND or SA licences.">
              <input id={`${id}-licence-name`} className={inputClass} value={form.licenceName} onChange={(e) => set('licenceName', e.target.value)} />
            </Field>
          )}
          <Field label="Licence link" htmlFor={`${id}-licence-url`} required hint="https:// only.">
            <input id={`${id}-licence-url`} type="url" className={inputClass} value={form.licenceUrl} onChange={(e) => set('licenceUrl', e.target.value)} />
          </Field>
          <Field
            label="Source link"
            htmlFor={`${id}-source`}
            required
            hint={form.licenceName === 'Made by Origin' ? 'Made by Origin: link the page or note that says how it was made.' : 'The page you took the track from.'}
          >
            <input id={`${id}-source`} type="url" className={inputClass} value={form.sourceUrl} onChange={(e) => set('sourceUrl', e.target.value)} />
          </Field>
          <Field label="Credit text" htmlFor={`${id}-credit`} required hint={`Shown to students as plain text. Left empty: “${suggestedCredit(form) || '‘Title’ by Artist, licence'}”.`}>
            <input
              id={`${id}-credit`}
              className={inputClass}
              maxLength={MUSIC_ATTRIBUTION_MAX}
              placeholder={suggestedCredit(form)}
              value={form.attributionText}
              onChange={(e) => set('attributionText', e.target.value)}
            />
          </Field>
          <label className="flex min-h-[2rem] items-center gap-2 text-sm">
            <input type="checkbox" checked={form.attributionRequired} onChange={(e) => set('attributionRequired', e.target.checked)} />
            The licence requires this credit (shown on the Music credits list)
          </label>
          <Field label="Licence proof" htmlFor={`${id}-proof`} hint="Screenshot or PDF of the page showing the licence on the day you took it. PDF, PNG or JPEG, up to 5 MB.">
            <input ref={proofRef} id={`${id}-proof`} type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" className="text-sm" onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
          </Field>
        </fieldset>

        <ErrorLine error={error} />
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={`${buttonClass} min-h-[2.75rem] px-5`} disabled={Boolean(busy) || reading || !file}>
            {busy ?? 'Upload as draft'}
          </button>
          {busy && <span className="text-sm text-muted-foreground" aria-live="polite">{busy}</span>}
        </div>
      </form>
    </Section>
  );
}

// ── Edit ─────────────────────────────────────────────────────────────────────

function EditRow({ track, onDone }: { track: Track; onDone: (changed: boolean) => void }) {
  const id = useId();
  const [title, setTitle] = useState(track.title);
  const [artist, setArtist] = useState(track.artist);
  const [mood, setMood] = useState<MusicMood>(track.mood);
  const [sortOrder, setSortOrder] = useState(String(track.sortOrder));
  const [credit, setCredit] = useState(track.attributionText);
  const [sourceUrl, setSourceUrl] = useState(track.sourceUrl);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const patch = parseTrackPatch({ title, artist, mood, sortOrder: Number(sortOrder), attributionText: credit, sourceUrl });
    if (!patch.ok) return setError(patch.error);
    setBusy(true);
    try {
      await send(`/tracks/${track.id}`, 'PATCH', patch.value);
      toast.success('Saved.');
      onDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr>
      <td colSpan={8} className="border-b bg-muted/30 p-3">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Title" htmlFor={`${id}-t`}>
            <input id={`${id}-t`} className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Artist" htmlFor={`${id}-a`}>
            <input id={`${id}-a`} className={inputClass} value={artist} onChange={(e) => setArtist(e.target.value)} />
          </Field>
          <Field label="Mood" htmlFor={`${id}-m`}>
            <select id={`${id}-m`} className={inputClass} value={mood} onChange={(e) => setMood(e.target.value as MusicMood)}>
              {MUSIC_MOODS.map((m) => (
                <option key={m} value={m}>
                  {MUSIC_MOOD_LABELS[m]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Order" htmlFor={`${id}-o`}>
            <input id={`${id}-o`} type="number" min={0} className={inputClass} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
          </Field>
          <Field label="Source link" htmlFor={`${id}-s`}>
            <input id={`${id}-s`} type="url" className={inputClass} value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
          </Field>
          <Field label="Credit text" htmlFor={`${id}-c`}>
            <input id={`${id}-c`} className={inputClass} value={credit} onChange={(e) => setCredit(e.target.value)} />
          </Field>
        </div>
        <ErrorLine error={error} />
        <div className="mt-3 flex gap-2">
          <button type="button" className={buttonClass} disabled={busy} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className={ghostButtonClass} disabled={busy} onClick={() => onDone(false)}>
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Track list ───────────────────────────────────────────────────────────────

function TrackActions({ track, onChanged, onEdit, onPreview }: { track: Track; onChanged: () => void; onEdit: () => void; onPreview: (url: string) => void }) {
  const [busy, setBusy] = useState(false);

  async function act(label: string, fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      toast.success(label);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  async function preview(what: 'audio' | 'proof') {
    try {
      const res = await fetch(`${API}/tracks/${track.id}/preview-url${what === 'proof' ? '?what=proof' : ''}`, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error(await readError(res));
      const { url } = (await res.json()) as { url: string };
      if (what === 'audio') onPreview(url);
      else window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open it.');
    }
  }

  const label = `“${track.title}”`;
  return (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" className={ghostButtonClass} disabled={busy} onClick={() => void preview('audio')} aria-label={`Listen to ${label}`}>
        Listen
      </button>
      {track.hasProof && (
        <button type="button" className={ghostButtonClass} disabled={busy} onClick={() => void preview('proof')} aria-label={`Open the licence proof of ${label}`}>
          Proof
        </button>
      )}
      <button type="button" className={ghostButtonClass} disabled={busy} onClick={onEdit} aria-label={`Edit ${label}`}>
        Edit
      </button>
      {track.status === 'draft' && (
        <button type="button" className={buttonClass} disabled={busy} onClick={() => void act('Published. Students can see it now.', () => send(`/tracks/${track.id}/publish`, 'POST'))} aria-label={`Publish ${label}`}>
          Publish
        </button>
      )}
      {track.status === 'published' && (
        <button
          type="button"
          className={ghostButtonClass}
          disabled={busy}
          aria-label={`Retire ${label}`}
          onClick={() => {
            if (!window.confirm(`Retire ${label}? It disappears for every student, and apps delete their downloaded copy. It cannot be published again (upload it again instead).`)) return;
            void act('Retired.', () => send(`/tracks/${track.id}/retire`, 'POST'));
          }}
        >
          Retire
        </button>
      )}
      {track.status !== 'published' && (
        <button
          type="button"
          className={`${ghostButtonClass} border-red-500/60 text-red-700 dark:text-red-300`}
          disabled={busy}
          aria-label={`Delete ${label}`}
          onClick={() => {
            if (!window.confirm(`Delete ${label} for good? The audio file, the licence proof and its listening history are removed. This cannot be undone.`)) return;
            void act('Deleted.', () => send(`/tracks/${track.id}`, 'DELETE'));
          }}
        >
          Delete
        </button>
      )}
    </div>
  );
}

export function MusicConsole() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(API, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error(await readError(res));
      setData(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const tracks = data?.tracks ?? [];
  const count = (s: MusicTrackStatus) => tracks.filter((t) => t.status === s).length;

  return (
    <div className="space-y-6">
      {data && !data.studentsCanSee && (
        <p role="status" className="rounded-md border border-amber-400/60 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
          <span className="font-semibold">Students cannot see music yet.</span> The BoomBoom switch (TEACHER_LAUNCH_STUDY_MUSIC) is off on this
          server, or turned off at /admin/incidents. You can still upload and publish tracks.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Published" value={count('published')} />
        <Stat label="Drafts" value={count('draft')} />
        <Stat label="Retired" value={count('retired')} />
        <Stat label="Storage" value={data ? mb(data.storageBytes) : '—'} />
      </div>

      <UploadForm onCreated={() => void load()} />

      <Section title={`Tracks${data ? ` (${tracks.length})` : ''}`}>
        <ErrorLine error={error} />
        {previewUrl && (
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border p-2">
            {/* Admin preview only: a 5-minute signed link, plain <audio>, no crossOrigin. */}
            <audio controls autoPlay src={previewUrl} className="max-w-full" aria-label="Track preview" />
            <button type="button" className={ghostButtonClass} onClick={() => setPreviewUrl(null)}>
              Close preview
            </button>
          </div>
        )}
        <Table head={['Track', 'Mood', 'Length', 'Size', 'Status', 'Licence', 'Added', 'Actions']} empty={data !== null && tracks.length === 0}>
          {tracks.map((t) =>
            editing === t.id ? (
              <EditRow
                key={t.id}
                track={t}
                onDone={(changed) => {
                  setEditing(null);
                  if (changed) void load();
                }}
              />
            ) : (
              <tr key={t.id}>
                <Td>
                  <p className="font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">{t.artist}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.loopable ? 'Loops · ' : ''}
                    {t.allowOffline ? 'Downloadable' : 'Streaming only'} · order {t.sortOrder}
                  </p>
                </Td>
                <Td>{MUSIC_MOOD_LABELS[t.mood]}</Td>
                <Td className="tabular-nums">{mmss(t.durationSeconds)}</Td>
                <Td className="whitespace-nowrap tabular-nums">{mb(t.sizeBytes)}</Td>
                <Td>
                  <StatusChip status={t.status} />
                </Td>
                <Td className="max-w-[18rem]">
                  <p>
                    <ExternalLink href={t.licenceUrl}>{t.licenceName}</ExternalLink>
                    {' · '}
                    <ExternalLink href={t.sourceUrl}>source</ExternalLink>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.attributionText}
                    {t.attributionRequired ? ' (credit required)' : ''}
                  </p>
                  {!t.hasProof && <p className="text-xs text-amber-700 dark:text-amber-300">No licence proof stored</p>}
                </Td>
                <Td className="whitespace-nowrap">{t.createdAt ? formatISTDateTimeDMY(t.createdAt) : '—'}</Td>
                <Td>
                  <TrackActions track={t} onChanged={() => void load()} onEdit={() => setEditing(t.id)} onPreview={setPreviewUrl} />
                </Td>
              </tr>
            ),
          )}
        </Table>
      </Section>
    </div>
  );
}
