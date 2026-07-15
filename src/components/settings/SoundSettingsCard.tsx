'use client';

import { useState } from 'react';
import { Volume2, VolumeX, Play, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/context/AuthContext';
import { updateProfileAction } from '@/server/actions/profile-actions';
import { cn } from '@/lib/utils';
import {
  DEFAULT_SOUND_PREFERENCES,
  normalizeSoundPreferences,
  soundSrc,
  type SoundCategoryKey,
  type SoundPreferences,
} from '@/lib/sound-preferences';
import { SOUND_CATEGORIES, soundOptions } from '@/lib/sound-catalog';
import { previewSound } from '@/lib/sound-manager';
import type { User as UserType } from '@/types';

function SoundRow({
  meta,
  value,
  volume,
  muted,
  onChange,
}: {
  meta: (typeof SOUND_CATEGORIES)[number];
  value: string | null;
  volume: number;
  muted: boolean;
  onChange: (file: string | null) => void;
}) {
  const options = soundOptions(meta.key);
  const Icon = meta.icon;

  const preview = () => {
    const src = soundSrc(meta.key, value);
    if (src) previewSound(src, volume);
  };

  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className={cn('w-8 h-8 rounded-lg bg-muted/40 flex items-center justify-center shrink-0', meta.accent)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black text-foreground truncate">{meta.title}</p>
        <p className="text-[10px] text-muted-foreground font-medium truncate">{meta.description}</p>
      </div>

      <div className="relative shrink-0">
        <select
          value={value ?? ''}
          onChange={(e) => {
            const next = e.target.value || null;
            onChange(next);
            if (next) {
              const src = soundSrc(meta.key, next);
              if (src && !muted) previewSound(src, volume);
            }
          }}
          className="appearance-none neu-inset rounded-xl bg-transparent pl-3 pr-8 py-2 text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-primary/30 w-[124px] cursor-pointer"
        >
          <option value="">None</option>
          {options.map((o) => (
            <option key={o.file} value={o.file}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
      </div>

      <button
        type="button"
        onClick={preview}
        disabled={!value || muted}
        aria-label={`Preview ${meta.title} sound`}
        className="w-9 h-9 rounded-xl neu-raised flex items-center justify-center text-primary shrink-0 disabled:opacity-30 active:scale-95 transition-transform"
      >
        <Play className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function SoundSettingsCard({ user }: { user: UserType }) {
  const { refreshUser } = useAuth();
  const [prefs, setPrefs] = useState<SoundPreferences>(() =>
    normalizeSoundPreferences(user.soundPreferences ?? DEFAULT_SOUND_PREFERENCES),
  );
  const [saving, setSaving] = useState(false);

  const setCategory = (key: SoundCategoryKey, file: string | null) =>
    setPrefs((p) => ({ ...p, [key]: file }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfileAction({ soundPreferences: prefs });
      await refreshUser();
      toast.success('Sound preferences saved');
    } catch {
      toast.error('Failed to save sound preferences');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="neu-raised p-5 space-y-4">
      {/* Header + master mute */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          {prefs.muted ? <VolumeX className="w-4 h-4 text-primary" /> : <Volume2 className="w-4 h-4 text-primary" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-foreground">Sound Effects</p>
          <p className="text-[10px] text-muted-foreground font-medium">Pick a sound for each event — tap ▶ to test</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!prefs.muted}
          onClick={() => setPrefs((p) => ({ ...p, muted: !p.muted }))}
          className={cn(
            'relative h-7 w-12 shrink-0 rounded-full transition-colors',
            prefs.muted ? 'bg-muted-foreground/30' : 'bg-primary',
          )}
        >
          <span className={cn('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all', prefs.muted ? 'left-1' : 'left-6')} />
        </button>
      </div>

      {/* Volume */}
      <div className={cn('flex items-center gap-3 transition-opacity', prefs.muted && 'opacity-40 pointer-events-none')}>
        <Volume2 className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(prefs.volume * 100)}
          onChange={(e) => setPrefs((p) => ({ ...p, volume: Number(e.target.value) / 100 }))}
          className="flex-1 accent-primary cursor-pointer"
          aria-label="Master volume"
        />
        <span className="text-[11px] font-black text-muted-foreground tabular-nums w-9 text-right">
          {Math.round(prefs.volume * 100)}%
        </span>
      </div>

      {/* Category dropdowns */}
      <div className={cn('divide-y divide-border/40 transition-opacity', prefs.muted && 'opacity-50')}>
        {SOUND_CATEGORIES.map((meta) => (
          <SoundRow
            key={meta.key}
            meta={meta}
            value={prefs[meta.key]}
            volume={prefs.volume}
            muted={prefs.muted}
            onChange={(file) => setCategory(meta.key, file)}
          />
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider disabled:opacity-50 transition-opacity"
      >
        {saving ? 'Saving…' : 'Save Sound Preferences'}
      </button>
    </div>
  );
}
