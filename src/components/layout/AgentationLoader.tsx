'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

// Loaded dynamically with ssr:false so it never runs during Next.js builds.
// The parent (layout.tsx) wraps this in process.env.NODE_ENV === 'development'
// so Webpack dead-code-eliminates the entire import chain in production — zero
// bytes shipped to the browser.
const AgentationTool = dynamic(
  () => import('agentation').then(mod => ({ default: mod.Agentation })),
  { ssr: false }
);

// Its toolbar is `position: fixed` in the bottom-right corner, which on a phone
// lands exactly on the "More" tab of the bottom nav and swallows the tap
// (reported on-device 2026-09-20). It portals straight into <body>, so a
// display:none wrapper does not reach it — the mount itself has to be gated.
export default function AgentationLoader() {
  const [wide, setWide] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const apply = () => setWide(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  if (!wide) return null;
  return <AgentationTool />;
}
