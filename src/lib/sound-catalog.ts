// Client-side catalog: UI metadata per category + the selectable file options
// (from the generated manifest). Keep server-safe model in sound-preferences.ts.
import {
  CheckCircle2,
  XCircle,
  Flame,
  ThumbsDown,
  Trophy,
  Frown,
  Bell,
  LogIn,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';

import manifestJson from './sound-manifest.json';
import { SOUND_FOLDERS, type SoundCategoryKey } from './sound-preferences';

export type SoundOption = { file: string; label: string };

const manifest = manifestJson as Record<string, SoundOption[]>;

export type SoundCategoryMeta = {
  key: SoundCategoryKey;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string; // tailwind text color for the icon
};

export const SOUND_CATEGORIES: SoundCategoryMeta[] = [
  { key: 'correct',        title: 'Correct answer',   description: 'Plays on a correct answer',        icon: CheckCircle2,  accent: 'text-emerald-500' },
  { key: 'wrong',          title: 'Wrong answer',     description: 'Plays on a wrong answer',          icon: XCircle,       accent: 'text-rose-500' },
  { key: 'streak3Correct', title: '3 correct streak', description: 'Every 3rd correct in a row',       icon: Flame,         accent: 'text-orange-500' },
  { key: 'streak3Wrong',   title: '3 wrong streak',   description: 'Every 3rd wrong in a row',         icon: ThumbsDown,    accent: 'text-amber-500' },
  { key: 'fullScore',      title: 'Full score',       description: 'Scoring 100% on a test',           icon: Trophy,        accent: 'text-yellow-500' },
  { key: 'badScore',       title: 'Low score',        description: 'A low test result',                icon: Frown,         accent: 'text-slate-400' },
  { key: 'notification',   title: 'Notification',     description: 'A new in-app notification',        icon: Bell,          accent: 'text-sky-500' },
  { key: 'signIn',         title: 'Sign in',          description: 'A successful login',               icon: LogIn,         accent: 'text-violet-500' },
  { key: 'warning',        title: 'Warning',          description: 'A proctoring / exam warning',      icon: AlertTriangle, accent: 'text-red-500' },
];

/** Selectable file options for a category (empty if the folder has no audio). */
export function soundOptions(key: SoundCategoryKey): SoundOption[] {
  return manifest[SOUND_FOLDERS[key]] ?? [];
}
