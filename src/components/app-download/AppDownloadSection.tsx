'use client';

import { Clock, Smartphone } from 'lucide-react';

import GetAppButton, { useAppDevice } from './GetAppButton';

/**
 * Landing section "Get Origin on your phone" (SEO_APP_DOWNLOAD_NOTES.md): a
 * phone frame showing a real app screen (the home screen from the Play Store
 * listing captures, 04/11/2026), the heading, one line of copy and the store
 * actions. Android: our own button (not Google's badge artwork) that opens
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
    <section id="get-the-app" aria-labelledby="get-the-app-title" data-mascot-state="success" data-mascot-side="left" className="relative z-10 py-10 sm:py-16 lg:py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 sm:px-6 md:grid-cols-2 md:gap-12 lg:gap-16">
        {/* Phone (left on md+, under the text on phones) */}
        <div className="order-2 flex justify-center md:order-1">
          <PhoneMockup />
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

/** CSS phone frame around a real screen capture (1080 × 2400). Size is reserved, so nothing jumps when it loads. */
function PhoneMockup() {
  return (
    <div className="relative w-[240px] sm:w-[270px] lg:w-[290px]">
      {/* Soft glow behind the phone, in the brand colour */}
      <div aria-hidden className="absolute -inset-10 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative rounded-[44px] bg-neutral-900 p-[9px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.45)] ring-1 ring-black/40 dark:ring-white/15">
        {/* Side buttons */}
        <span aria-hidden className="absolute -right-[3px] top-28 h-14 w-[3px] rounded-r bg-neutral-800" />
        <span aria-hidden className="absolute -right-[3px] top-48 h-9 w-[3px] rounded-r bg-neutral-800" />
        <div className="relative overflow-hidden rounded-[36px] bg-black">
          {/* Pre-sized WebP from public/ (no image optimiser needed); width and height reserve the space.
              No AVIF: the auth middleware's static-file list (src/middleware.ts matcher) has no .avif. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- static, pre-sized asset */}
          <img
            src="/app/app-home-600.webp"
            srcSet="/app/app-home-300.webp 300w, /app/app-home-600.webp 600w"
            sizes="(min-width: 1024px) 272px, (min-width: 640px) 252px, 222px"
            width={600}
            height={1333}
            loading="lazy"
            decoding="async"
            alt="The Origin app home screen: today's missions with Ori, continue practice and study rooms"
            className="block h-auto w-full"
          />
          {/* Punch-hole camera */}
          <span aria-hidden className="absolute left-1/2 top-2.5 size-3 -translate-x-1/2 rounded-full bg-black ring-2 ring-neutral-800" />
        </div>
      </div>
    </div>
  );
}
