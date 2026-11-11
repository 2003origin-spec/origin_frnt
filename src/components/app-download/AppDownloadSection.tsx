'use client';

import { Clock, Smartphone } from 'lucide-react';

import GetAppButton, { useAppDevice } from './GetAppButton';

/**
 * Landing section "Get Origin on your phone" (SEO_APP_DOWNLOAD_NOTES.md): a
 * hand holding a phone with a real app screen (the home screen from the Play
 * Store listing captures, 04/11/2026), the heading, one line of copy and the
 * store actions. Android: our own button (not Google's badge artwork) that opens
 * Google Play on Android and the QR dialog elsewhere. iOS is not on the App
 * Store yet, so it is a plain "coming soon" note, never a button.
 * All text renders on the server; the image is lazy with its size reserved.
 * Hidden inside our Android app (after hydration; the server render shows it).
 */
export default function AppDownloadSection() {
  const device = useAppDevice();
  if (device === 'in-app') return null;
  return (
    // data-mascot-*: the landing's background 3D Ori moves to the phone side here, so the heading stays clear.
    <section id="get-the-app" aria-labelledby="get-the-app-title" data-mascot-state="success" data-mascot-side="left" className="relative z-10 py-10 sm:py-16">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 sm:px-6 md:grid-cols-2 md:gap-12 lg:gap-16">
        {/* Phone (left on md+, under the text on phones) */}
        <div className="order-2 flex justify-center md:order-1">
          <PhoneInHand />
        </div>

        <div className="order-1 flex flex-col items-center gap-5 text-center md:order-2 md:items-start md:text-left">
          <p className="inline-flex items-center gap-2 rounded-full px-4 py-2 neu-inset">
            <span aria-hidden className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse" />
            <span className="text-[10px] font-heading font-black uppercase tracking-[0.4em] text-primary">Mobile app</span>
          </p>
          <h2 id="get-the-app-title" className="text-3xl font-heading font-black leading-[0.95] tracking-tighter sm:text-5xl lg:text-6xl">
            Get <span className="bg-gradient-to-r from-primary via-primary/90 to-primary bg-clip-text text-transparent">Origin</span> on your phone
          </h2>
          <p className="max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
            Practise, ask Ori your doubts and take mock tests on your Android phone, with the same account you use here.
          </p>

          <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
            <GetAppButton
              placement="landing_section"
              className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-primary px-6 text-left text-primary-foreground shadow-lg shadow-primary/20 transition-transform motion-safe:hover:-translate-y-0.5"
            >
              <Smartphone aria-hidden className="size-6 shrink-0" />
              <span className="flex flex-col leading-tight">
                <span className="text-[12px] font-medium opacity-90">Free on Google Play</span>
                <span className="text-[17px] font-bold">Download for Android</span>
              </span>
            </GetAppButton>
            <p className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl border border-dashed border-border px-6 text-left text-muted-foreground">
              <Clock aria-hidden className="size-5 shrink-0" />
              <span className="flex flex-col leading-tight">
                <span className="text-[12px] font-medium">iPhone &amp; iPad</span>
                <span className="text-[15px] font-semibold text-foreground">iOS app coming soon</span>
              </span>
            </p>
          </div>
          <p className="hidden text-[13px] text-muted-foreground md:block">On a computer? The button shows a QR code to scan with your phone.</p>
        </div>
      </div>
    </section>
  );
}

/**
 * A hand holding the phone with the real app home screen on it: a 3D render
 * (Blender, toy style like Ori; the screen is the Play Store listing capture),
 * transparent WebP. width/height reserve the space, so nothing jumps on load.
 */
function PhoneInHand() {
  return (
    <div className="relative w-[230px] sm:w-[260px] lg:w-[270px]">
      {/* Soft glow behind the phone, in the brand colour */}
      <div aria-hidden className="absolute inset-x-0 top-[10%] h-[60%] rounded-full bg-primary/25 blur-3xl" />
      {/* eslint-disable-next-line @next/next/no-img-element -- static, pre-sized asset (no image optimiser needed) */}
      <img
        src="/app/app-in-hand-800.webp"
        srcSet="/app/app-in-hand-400.webp 400w, /app/app-in-hand-800.webp 800w"
        sizes="(min-width: 1024px) 270px, (min-width: 640px) 260px, 230px"
        width={800}
        height={1979}
        loading="lazy"
        decoding="async"
        alt="A hand holding a phone showing the Origin app home screen: today's missions with Ori, continue practice and study rooms"
        className="relative block h-auto w-full drop-shadow-[0_24px_30px_rgba(0,0,0,0.25)]"
      />
    </div>
  );
}
