// Scans public/sounds/<Folder>/ and writes src/lib/sound-manifest.json:
//   { "<Folder>": [ { "file": "<name.ext>", "label": "<Friendly>" }, ... ] }
// Excludes .DS_Store and non-audio (.mov). Re-run when sounds change:
//   node scripts/build-sound-manifest.mjs
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const soundsDir = join(root, 'public', 'sounds');
const outFile = join(root, 'src', 'lib', 'sound-manifest.json');

// Browsers can't reliably decode .mov via <audio>; keep web-safe audio only.
const AUDIO_EXT = new Set(['.mp3', '.m4a', '.ogg', '.wav', '.aac']);

function titleCase(s) {
  return s
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function friendlyLabel(file) {
  const base = file.replace(/\.[^.]+$/, '');
  // Descriptive success-/fail- names → keep the meaningful tail.
  const desc = base.match(/^(?:success|fail)(?:-vocal)?-(.+)$/i);
  if (desc) return titleCase(desc[1].replace(/[-_]/g, ' '));
  // Anything ending in a number → "Variant N".
  const num = base.match(/(\d+)\s*$/);
  if (num) return `Variant ${num[1]}`;
  return titleCase(base.replace(/[-_]/g, ' '));
}

const manifest = {};
for (const entry of readdirSync(soundsDir)) {
  const folder = join(soundsDir, entry);
  if (!statSync(folder).isDirectory()) continue;
  const files = readdirSync(folder)
    .filter((f) => AUDIO_EXT.has(extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((file) => ({ file, label: friendlyLabel(file) }));
  if (files.length) manifest[entry] = files;
}

writeFileSync(outFile, JSON.stringify(manifest, null, 2) + '\n');
const total = Object.values(manifest).reduce((n, a) => n + a.length, 0);
console.log(`Wrote ${outFile} — ${Object.keys(manifest).length} folders, ${total} files`);
