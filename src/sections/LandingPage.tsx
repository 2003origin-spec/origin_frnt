'use client';
import { useRef, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useMainScrollContainer } from '@/hooks/useMainScrollContainer';
import SmoothScroll from '@/components/providers/SmoothScroll';
import { ContestBanner } from '@/components/contest/ContestBanner';
import NoiseOverlay from '@/components/landing/NoiseOverlay';
import type { MascotState } from '@/features/mascot/mascot-state';
import { useTheme } from 'next-themes';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { Menu, X, Sun, Moon, Gamepad2, Smartphone } from 'lucide-react';
import GetAppButton from '@/components/app-download/GetAppButton';
import AppDownloadSection from '@/components/app-download/AppDownloadSection';
import AppDownloadPill from '@/components/app-download/AppDownloadPill';
import { EXAM_PAGE_LIST } from '@/lib/seo/rank-predictor-seo';
import LandingCTABtn from '@/components/landing/LandingCTABtn';
import HeroDoubtBox from '@/components/landing/HeroDoubtBox';
import GooglePlayLogo from '@/components/landing/GooglePlayLogo';
import {
  DayWithOrigin,
  OnlyOnOrigin,
  PhoneShowcase,
  PriceSection,
  ProductWindow,
  QuestionsAndClose,
  WhyTrust,
  askInHero,
  type OnlyOnOriginFlags,
} from '@/components/landing/orbit/OrbitSections';
import { GlassPanel } from '@/components/glassyui/glass-panel';
import { GlassButton } from '@/components/glassyui/glass-button';
import './landing-glass.css';
import { Plus_Jakarta_Sans } from 'next/font/google';

const OriMascot = dynamic(() => import('@/features/mascot/OriMascot'), { ssr: false });
const CustomCursor = dynamic(() => import('@/components/landing/CustomCursor'), { ssr: false });
const RankPredictorWidget = dynamic(() => import('@/components/landing/RankPredictorWidget'), {
  ssr: false,
});

// Landing-page typeface: Plus Jakarta Sans for headings and body (one variable font file
// covers every weight; headings use 800, body 400-600). Scoped to
// .landing-glass in landing-glass.css; the rest of the site keeps Darker Grotesque.
const landingFont = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-landing-body', display: 'swap' });

/*
 * O3 Origin landing page (plan and decision log: V1/GLASSY_LANDING_PLAN.md).
 * Eight screens, each answering the next question a visitor has:
 *   1 hero: what is this, try it now (working doubt box)    2 #demo: what an answer looks like
 *   3 #how-it-works: a day with Origin (real app screens)    4 #rank-predictor: free, no account
 *   5 #features: only on Origin (live features only)         6 #knowledge-base: why trust it
 *   7 #pricing: plans, for parents too                       8 #faq: questions + close
 */

interface LandingPageProps {
  onGetStarted: () => void;
  /** `rankPredictor` flag, resolved on the server (runtime kill switch included). */
  rankPredictorEnabled?: boolean;
  /** Request came from our Android app shell (server UA check): no "get the app" section or pill. */
  inAppShell?: boolean;
  /** Which "only on Origin" features are live (server flags). */
  flags?: OnlyOnOriginFlags;
}

const NO_FLAGS: OnlyOnOriginFlags = { originNow: false, contest: false, notes: false };

// The hero phone's screen: the app's home (clock edited to 7:59 so it matches "Good evening").
const HERO_SCREENS = ['/landing/app/02-home1-hd.webp'];
const HERO_ALTS = ["The Origin app's home screen: today's study missions orbiting Ori"];

export default function LandingPage({ onGetStarted, rankPredictorEnabled = false, inAppShell = false, flags = NO_FLAGS }: LandingPageProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  const [mascotState, setMascotState] = useState<MascotState>('idle');
  // A section can ask for no 3D Ori (data-mascot-side="none"): the hero and the pinned-phone story,
  // where the model would cover a phone screen.
  const [mascotHidden, setMascotHidden] = useState(true);
  const { setTheme, resolvedTheme } = useTheme();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  // The landing page opens dark (the app's space look) for anyone who has not chosen a theme.
  // Before mount it renders dark on the server and the client alike, so there is no flash and
  // no hydration mismatch; a visitor's saved choice takes over once mounted.
  const actualTheme = mounted ? (resolvedTheme === 'light' ? 'light' : 'dark') : 'dark';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showStickyCTA, setShowStickyCTA] = useState(false);
  const showStickyCTARef = useRef(false);

  // Mouse-driven Y parallax for the traversing mascot
  const mascotMouseYRaw = useMotionValue(0);
  const mascotMouseY = useSpring(mascotMouseYRaw, { stiffness: 28, damping: 22 });

  // Section-driven horizontal side: the mascot sits at the LEFT/RIGHT edge that
  // each section declares (via data-mascot-side), gliding between them as you
  // scroll. Keeps it clear of the centred content cards and lets each screen
  // place Ori deliberately (e.g. Manifesto → left). Container tied to <main>.
  const scrollContainer = useMainScrollContainer();
  const mascotSideVw = useMotionValue(48); // hero: Ori waits at the right edge, hidden (the phone shows the app)
  const mascotXNum = useSpring(mascotSideVw, { stiffness: 38, damping: 22, mass: 0.7 });
  const mascotX = useTransform(mascotXNum, (v) => `${v}vw`);

  // Responsive mascot footprint — smaller on phones/tablets so it never dominates.
  const [mascotSize, setMascotSize] = useState(580);
  // Live WebGL mascot only from 1024 px. Phones and tablets get a still Ori in
  // the hero orbit instead (on tablets the 3D model covered the centred
  // headline) — also avoids streaming multi-MB GLBs + a render loop on budget
  // devices / metered data. Starts false so SSR + first paint never mount WebGL.
  const [show3DMascot, setShow3DMascot] = useState(false);
  // "Play with Ori" direct-interaction mode (dark theme only).
  const [playMode, setPlayMode] = useState(false);
  const [playMood, setPlayMood] = useState<MascotState>('idle');
  const [orbitCoords, setOrbitCoords] = useState<{ azimuthDeg: number; polarDeg: number }>({ azimuthDeg: 0, polarDeg: 0 });


  const handleBeginJourney = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setIsTransitioning(true);
    setTimeout(() => {
      onGetStarted();
    }, 800);
  };


  // Landing-page section links, in page order; each maps to a section id on this page.
  const navLinks = [
    { name: 'How it works', sectionId: 'how-it-works' },
    ...(rankPredictorEnabled ? [{ name: 'Rank predictor', sectionId: 'rank-predictor' }] : []),
    { name: 'Pricing', sectionId: 'pricing' },
    { name: 'FAQ', sectionId: 'faq' },
    { name: 'Founders', href: '/founders' },
  ] as { name: string; sectionId?: string; href?: string }[];

  // The page's one main action: guests ask Ori in the hero; signed-in students go to the app.
  const mainActionLabel = user ? 'Open Origin' : 'Ask a doubt free';
  const runMainAction = () => {
    setMobileMenuOpen(false);
    if (user) handleBeginJourney();
    else askInHero();
  };

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleNavLinkClick = (e: React.MouseEvent, sectionId: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    scrollToSection(sectionId);
  };

  useEffect(() => {
    // No saved theme yet (first visit): make dark the stored choice, so the page, its dialogs
    // and the app after sign-up all agree. A saved 'light' is left alone.
    try {
      if (window.localStorage.getItem('theme') === null) setTheme('dark');
    } catch {
      // Storage blocked (private mode): the page still renders dark from the default above.
    }
    setMounted(true);
  }, [setTheme]);

  const mainRef = useRef<HTMLElement | null>(null);
  const [mountedMain, setMountedMain] = useState(false);

  useEffect(() => {
    mainRef.current = document.querySelector('main');
    setMountedMain(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mainScroller = mainRef.current;
    const handleScroll = () => {
      const scrollTop = mainScroller ? mainScroller.scrollTop : window.scrollY;

      const shouldShow = scrollTop > 400;
      if (shouldShow !== showStickyCTARef.current) {
        showStickyCTARef.current = shouldShow;
        setShowStickyCTA(shouldShow);
      }
    };
    if (mainScroller) {
      mainScroller.addEventListener('scroll', handleScroll, { passive: true });
    } else {
      window.addEventListener('scroll', handleScroll, { passive: true });
    }
    return () => {
      if (mainScroller) {
        mainScroller.removeEventListener('scroll', handleScroll);
      } else {
        window.removeEventListener('scroll', handleScroll);
      }
    };
  }, [mountedMain]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const offsetY = (e.clientY - window.innerHeight / 2) * 0.1;
      mascotMouseYRaw.set(offsetY);
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, [mascotMouseYRaw]);

  // Responsive mascot size (re-evaluated on resize)
  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth;
      setMascotSize(440); // small enough to stand in the side margin beside centred content
      setShow3DMascot(w >= 1024);
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);

  // Scroll-driven mascot: change emotion model + side as sections come into view.
  // No hover triggers — only scroll position determines the model. The hero section
  // uses data-mascot-state="idle" so ori-hi-opt.glb always shows there.
  useEffect(() => {
    if (!show3DMascot) return;
    const root = scrollContainer.current;
    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-mascot-state]'));
    if (!sections.length) return;
    const ratios = new Map<Element, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) ratios.set(e.target, e.intersectionRatio);
          else ratios.delete(e.target);
        }
        let best: Element | null = null;
        let max = 0;
        for (const [el, r] of ratios) {
          if (r > max) { max = r; best = el; }
        }
        const next = best?.getAttribute('data-mascot-state') as MascotState | null;
        if (next) setMascotState(next);
        const side = best?.getAttribute('data-mascot-side');
        if (side) setMascotHidden(side === 'none');
        if (side && side !== 'none') mascotSideVw.set(side === 'left' ? -48 : side === 'center' ? 0 : 48);
      },
      { root, threshold: [0.2, 0.4, 0.6, 0.8] },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [actualTheme, scrollContainer, mountedMain, show3DMascot]);

  // Esc closes Play-with-Ori mode
  useEffect(() => {
    if (!playMode) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPlayMode(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playMode]);

  return (
    <SmoothScroll>
      <NoiseOverlay />
      <CustomCursor />
      <div data-lg-theme={actualTheme} className={`${landingFont.variable} landing-glass ${actualTheme === 'dark' ? 'dark' : ''} min-h-dvh bg-background text-foreground selection:bg-primary/20 font-sans antialiased transition-colors duration-500 relative overflow-x-visible`}>
        {/* The app's "Orbit" space background: deep-space colour, a static nebula and
            twinkling stars (dark), or the app's pale page with soft washes (light).
            Theme comes from the html.dark class, so it is right on first paint. */}
        <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
          <div className="landing-glass-backdrop">
            <span className="landing-glass-stars landing-glass-stars--tiny" />
            <span className="landing-glass-stars landing-glass-stars--mid" />
            <span className="landing-glass-stars landing-glass-stars--twinkle-a" />
            <span className="landing-glass-stars landing-glass-stars--twinkle-b" />
          </div>
        </div>
        {/* Ori theme: floating 2D ori images + traversing 3D mascot — both themes */}
        {mounted && (
          <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
            {/* 3D OriMascot — scroll-driven zig-zag (centre→right→left→right→centre)
                + mouse Y parallax. Margin-centred so Framer owns the transform.
                Tablet/desktop only; phones rely on the 2D floats above.
                preload=false → only the current section's model streams in
                (~3 MB on demand) instead of all six (~16 MB) upfront. */}
            {show3DMascot && (
              <motion.div
                className={`absolute pointer-events-none transition-opacity duration-700 ${mascotHidden ? 'opacity-0' : 'opacity-100'}`}
                style={{
                  top: '50%',
                  left: '50%',
                  marginTop: -mascotSize / 2,
                  marginLeft: -mascotSize / 2,
                  width: mascotSize,
                  height: mascotSize,
                  x: mascotX,
                  y: mascotMouseY,
                }}
              >
                {/* Light theme: Ori's body is white, the canvas is transparent and the page
                    background is white — so without a backdrop the model is invisible. This
                    soft blue halo (travels with the mascot) gives the white model contrast. */}
                {actualTheme === 'light' && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        'radial-gradient(circle at 50% 46%, rgba(37,99,235,0.20) 0%, rgba(37,99,235,0.10) 34%, rgba(37,99,235,0.04) 52%, transparent 66%)',
                    }}
                  />
                )}
                <OriMascot state={mascotState} className="relative w-full h-full" preload={false} />
              </motion.div>
            )}
          </div>
        )}

        {/* Fixed Navbar – outside the hero motion.div so CSS fixed works across all sections */}
        <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none safe-top">
          <GlassPanel variant="pill" preset="prominent" elevation="raised" className="pointer-events-auto max-w-7xl mx-auto w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] mt-3 sm:mt-6 p-0">
          <nav className="relative flex flex-row justify-between items-center px-4 py-2.5 sm:px-6 md:px-8 md:py-3.5">
            <div className="flex items-center gap-1.5 sm:gap-3">
              <img src="/origin-new.jpg" alt="ORIGIN" className="h-7 w-auto sm:h-9 rounded-lg object-contain" />
              <span
                className="text-lg xs:text-xl sm:text-2xl md:text-3xl tracking-tight text-foreground font-heading font-black whitespace-nowrap"
              >
                O3 Origin<sup className="text-[10px]">®</sup>
              </span>
            </div>

            {/* Desktop Links (lg and up; below that the six links do not fit beside the actions
                without wrapping, so tablets use the menu drawer like phones) — scroll to page sections or route */}
            {/* gap-4 below xl: at 768–1023 px gap-8 made the bar ~20 px wider than the screen, and at
                1024–1279 px the brand name ran 24 px under the first link (measured at 1024). */}
            <div className="hidden lg:flex items-center gap-3 xl:gap-8">
              {navLinks.map((link) => (
                link.href ? (
                  <Link
                    key={link.name}
                    href={link.href}
                    className="inline-flex min-h-11 items-center whitespace-nowrap text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.name}
                  </Link>
                ) : (
                  <a
                    key={link.name}
                    href={`#${link.sectionId}`}
                    onClick={(e) => handleNavLinkClick(e, link.sectionId!)}
                    className="inline-flex min-h-11 items-center whitespace-nowrap text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.name}
                  </a>
                )
              ))}
            </div>

            <div className="flex items-center gap-2 sm:gap-4 md:gap-2 xl:gap-4">
              {/* Get the app (desktop bar; phones get it in the menu). Icon only at 768–1279 px, where the bar is full. */}
              <GetAppButton
                placement="landing_nav"
                label="Get the app"
                className="landing-glass-chip hidden md:inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-border/60 px-3 xl:px-4 text-sm font-semibold text-foreground transition-colors hover:bg-foreground/5 whitespace-nowrap"
              >
                <Smartphone aria-hidden className="w-4 h-4" />
                <span className="hidden xl:inline">Get the app</span>
              </GetAppButton>
              <GlassButton
                variant="soft"
                onClick={() => setTheme(actualTheme === 'dark' ? 'light' : 'dark')}
                aria-label="Toggle dark mode"
                className="hidden sm:inline-flex rounded-full w-11 h-11 min-w-11 p-0"
              >
                {mounted && (actualTheme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-primary" />)}
              </GlassButton>

              {/* Below 640 px the hero's own button and the bottom bar carry the action; here it
                  would push the brand name off the bar. */}
              <span className="hidden sm:inline-flex">
                <LandingCTABtn label={mainActionLabel} onClick={runMainAction} variant="xs" />
              </span>

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileMenuOpen}
                className="lg:hidden inline-flex h-11 w-11 items-center justify-center text-foreground"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </nav>
          </GlassPanel>
        </div>

        {/* Mobile Menu – slides in from right */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 lg:hidden"
            >
              {/* Backdrop */}
              <div
                className="absolute inset-0 bg-black/25"
                onClick={() => setMobileMenuOpen(false)}
              />
              {/* Drawer: scrolls on its own when it is taller than the screen (short phones,
                  landscape, large text), without scrolling the page behind it */}
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                className="landing-glass-sheet absolute right-0 top-0 bottom-0 w-[min(80vw,300px)] flex flex-col overflow-y-auto overscroll-contain pt-20 pb-10 px-8 gap-2 [&>*]:shrink-0"
              >
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="absolute top-6 right-6 w-9 h-9 neu-raised rounded-full flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>

                <div className="flex flex-col gap-1 mb-6">
                  {navLinks.map((link) => (
                    link.href ? (
                      <Link
                        key={link.name}
                        href={link.href}
                        className="flex items-center gap-2 px-4 py-3.5 rounded-2xl text-base font-heading font-black uppercase tracking-[0.12em] transition-all active:scale-95 text-muted-foreground hover:text-foreground hover:neu-raised"
                      >
                        {link.name}
                      </Link>
                    ) : (
                      <a
                        key={link.name}
                        href={`#${link.sectionId}`}
                        onClick={(e) => handleNavLinkClick(e, link.sectionId!)}
                        className="flex items-center gap-2 px-4 py-3.5 rounded-2xl text-base font-heading font-black uppercase tracking-[0.12em] transition-all active:scale-95 text-muted-foreground hover:text-foreground hover:neu-raised"
                      >
                        {link.name}
                      </a>
                    )
                  ))}
                </div>

                <GetAppButton
                  placement="landing_menu"
                  className="mb-6 flex min-h-12 items-center gap-3 rounded-2xl border border-border/60 px-4 py-3 text-base font-heading font-black text-foreground transition-colors hover:bg-foreground/5"
                >
                  <Smartphone aria-hidden className="w-5 h-5 text-primary" /> Get the app
                </GetAppButton>

                <div className="h-px bg-border/40 mb-6" />

                <div className="flex flex-col gap-3">
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground px-4">Appearance</span>
                  <button
                    onClick={() => setTheme(actualTheme === 'dark' ? 'light' : 'dark')}
                    className="neu-btn flex items-center gap-3 px-5 py-3.5 rounded-2xl border-0 text-foreground font-heading font-black text-sm"
                  >
                    {mounted
                      ? (actualTheme === 'dark'
                          ? <><Sun className="w-4 h-4 text-amber-400" /> Light Mode</>
                          : <><Moon className="w-4 h-4 text-primary" /> Dark Mode</>)
                      : <><Moon className="w-4 h-4 text-primary" /> Dark Mode</>}
                  </button>
                  <LandingCTABtn
                    label={mainActionLabel}
                    onClick={runMainAction}
                    variant="sm"
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Exit animation wrapper for "Open Origin" (signed-in students); never filtered at rest */}
        <motion.div
          animate={isTransitioning ? { scale: 0.98, opacity: 0, filter: 'blur(8px)' } : { scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative z-10"
        >
          {/* 1 · Hero. Reading order (top-left first): what this is and who it is for, how it
              helps, then a working doubt box, the one main action. The app's real home screen
              stands beside it. */}
          <section
            ref={heroRef}
            data-mascot-state="idle"
            data-mascot-side="none"
            className="relative mx-auto grid w-full max-w-7xl items-center gap-10 px-5 pb-16 pt-28 sm:px-6 sm:pt-32 lg:min-h-dvh lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12 lg:pb-20 xl:grid-cols-[minmax(0,1fr)_430px]"
          >
            <div className="flex min-w-0 flex-col">
              <motion.h1
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="landing-h1 max-w-[14ch]"
              >
                AI mentor for JEE and NEET students
              </motion.h1>
              <p className="landing-lead mt-5 max-w-xl text-lg">
                Type or say any Physics, Chemistry, Maths or Biology doubt. Ori explains it step by step, then helps you
                practise what you got wrong.
              </p>
              <div className="mt-7 max-w-2xl">
                <HeroDoubtBox
                  onSignUp={handleBeginJourney}
                  secondary={
                    inAppShell ? null : (
                      <GetAppButton
                        placement="landing_hero"
                        label="Get the Android app on Google Play"
                        className="landing-play-badge inline-flex min-h-14 items-center gap-3 rounded-2xl px-5 text-left"
                      >
                        <GooglePlayLogo className="h-7 w-7 shrink-0" />
                        <span className="flex flex-col leading-tight">
                          <span className="text-[11px] font-semibold uppercase tracking-wide opacity-80">Get it on</span>
                          <span className="text-lg font-bold">Google Play</span>
                        </span>
                      </GetAppButton>
                    )
                  }
                />
              </div>
              <p className="mt-5 flex items-center gap-2 text-sm text-[var(--lg-muted-foreground)]">
                Answers powered by
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-2.5 py-1 text-xs font-bold text-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/Sarvam-AI.png" alt="" className="h-4 w-auto object-contain" /> Sarvam AI
                </span>
              </p>
            </div>
            <PhoneShowcase
              screens={HERO_SCREENS}
              alts={HERO_ALTS}
              priority
              className="mx-auto w-[min(84vw,340px)] lg:w-[300px] xl:w-[330px]"
              stageClassName="h-[min(178vw,720px)] w-full lg:h-[660px] xl:h-[720px]"
            />
          </section>

          {/* 2 · The product, big */}
          <ProductWindow />

          {/* 3 · A day with Origin — the page's one moving moment */}
          <DayWithOrigin rankPredictorEnabled={rankPredictorEnabled} />

          {/* 4 · Free, no account: the rank predictor (flag on only) */}
          {rankPredictorEnabled ? (
            <div className="relative" data-mascot-state="curious" data-mascot-side="none">
              <RankPredictorWidget />
            </div>
          ) : null}

          {/* 5 · Only on Origin — live features only */}
          <OnlyOnOrigin
            flags={flags}
            contestSlot={flags.contest ? <ContestBanner userId={user?.id ?? null} /> : null}
          />

          {/* 6 · Why trust it */}
          <WhyTrust />

          {/* 7 · Plans and prices */}
          <PriceSection onSignUp={handleBeginJourney} />

          {/* 8 · Questions + close */}
          <QuestionsAndClose />
        </motion.div>

        {/* Get Origin on your phone — real app screen + store actions */}
        {inAppShell ? null : <AppDownloadSection />}

        {/* Footer */}
        <footer className="landing-glass-footer relative z-10 pt-10 pb-28 lg:pb-24">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center md:items-end justify-between gap-8">
            <div className="flex flex-col items-center md:items-start gap-2">
              <span className="text-[10px] font-black text-muted-foreground/60 tracking-[0.4em]">© 2026 SUPERGOAT TECHNOLOGIES PRIVATE LIMITED</span>
              {/* Free tools: plain links so search engines find the predictor pages from home (flag on only). */}
              {rankPredictorEnabled && (
                <nav aria-label="Free tools" className="flex flex-wrap justify-center md:justify-start gap-2 sm:gap-4 text-xs text-muted-foreground mt-2">
                  <Link href="/rank-predictor" className="inline-flex min-h-11 items-center hover:text-primary transition-colors font-semibold text-foreground">Free Rank Predictor</Link>
                  {EXAM_PAGE_LIST.map((page) => (
                    <span key={page.path} className="contents">
                      <span className="hidden sm:inline text-border">•</span>
                      <Link href={page.path} className="inline-flex min-h-11 items-center hover:text-primary transition-colors font-medium">{page.heading}</Link>
                    </span>
                  ))}
                </nav>
              )}
              <div className="flex flex-wrap gap-2 sm:gap-4 text-xs text-muted-foreground mt-2">
                <a href="/terms-and-conditions" className="inline-flex min-h-11 items-center hover:text-primary transition-colors font-medium">Terms & Conditions</a>
                <span className="hidden sm:inline text-border">•</span>
                <a href="/privacy-policy" className="inline-flex min-h-11 items-center hover:text-primary transition-colors font-medium">Privacy Policy</a>
                <span className="hidden sm:inline text-border">•</span>
                <a href="/childrens-policy" className="inline-flex min-h-11 items-center hover:text-primary transition-colors font-medium">Children's Safety Policy</a>
                <span className="hidden sm:inline text-border">•</span>
                <a href="/refund-policy" className="inline-flex min-h-11 items-center hover:text-primary transition-colors font-medium">Refund Policy</a>
                <span className="hidden sm:inline text-border">•</span>
                <a href="/return-policy" className="inline-flex min-h-11 items-center hover:text-primary transition-colors font-medium">Return Policy</a>
                <span className="hidden sm:inline text-border">•</span>
                <a href="/shipping-policy" className="inline-flex min-h-11 items-center hover:text-primary transition-colors font-medium">Shipping Policy</a>
                <span className="hidden sm:inline text-border">•</span>
                <a href="/faq" className="inline-flex min-h-11 items-center hover:text-primary transition-colors font-medium">FAQ</a>
              </div>
              <img src="/origin-new.jpg" alt="ORIGIN" className="h-12 w-auto dark:brightness-110 mt-3" />
            </div>
            <div className="flex flex-col items-center md:items-end gap-4">
              <span className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.4em]">Connect With Us</span>
              <div className="flex gap-4 sm:gap-5 items-center">
                <a href="https://chat.whatsapp.com/BBwpKNeiCypGzeVMwsw9ns?mode=gi_t" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform"><img src="/images/SocialMedia/Whatsapp-Logo.png" alt="WhatsApp" className="h-8 sm:h-10 w-auto" /></a>
                <a href="https://www.linkedin.com/company/o3-origin/" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform"><img src="/images/SocialMedia/LinkedIn.png" alt="LinkedIn" className="h-8 sm:h-10 w-auto" /></a>
                <a href="https://x.com/O3_origin" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform"><img src="/images/SocialMedia/X.jpg" alt="X" className="h-8 sm:h-10 w-auto rounded-md" /></a>
                <a href="https://www.instagram.com/o3.origin/?hl=en" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform"><img src="/images/SocialMedia/Instagram.png" alt="Instagram" className="h-8 sm:h-10 w-auto" /></a>
              </div>
            </div>
          </div>
        </footer>

        {/* Mobile & Tablet Sticky bottom CTA */}
        <AnimatePresence>
          {showStickyCTA && (
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="landing-glass-bar fixed bottom-0 left-0 right-0 z-40 lg:hidden px-4 pb-5 pt-3"
            >
              <LandingCTABtn
                label={mainActionLabel}
                onClick={runMainAction}
                className="w-full"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating "Get the app / Scan to download" (tablet/desktop; bottom-left, clear of Play with Ori) */}
        {/* Only after the hero: there it would cover the doubt box, and the hero has its own app button. */}
        {inAppShell || !showStickyCTA ? null : <AppDownloadPill />}

        {/* ── Play with Ori — direct 3D interaction (tablet/desktop only) ────── */}
        {mounted && show3DMascot && (
          <>
            {/* Floating launcher */}
            <AnimatePresence>
              {!playMode && (
                <motion.button
                  type="button"
                  onClick={() => setPlayMode(true)}
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: 20 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                  className="fixed z-40 bottom-28 right-4 lg:bottom-6 lg:right-6 group flex items-center gap-2.5 pl-2 pr-4 py-2 rounded-full text-sm font-black tracking-tight text-white"
                  style={{
                    background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
                    boxShadow: '0 8px 30px rgba(37,99,235,0.45), inset 0 1px 0 rgba(255,255,255,0.25)',
                  }}
                  aria-label="Play with Ori"
                >
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/15">
                    <img
                      src="/ori2d/ori-happy.png"
                      alt=""
                      draggable={false}
                      className="w-6 h-6 object-contain select-none mascot-float-anim"
                    />
                  </span>
                  Play with Ori
                </motion.button>
              )}
            </AnimatePresence>

            {/* Foreground interaction overlay */}
            <AnimatePresence>
              {playMode && (
                <motion.div
                  className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  {/* Dim + blur backdrop — click to exit */}
                  <div
                    className="absolute inset-0 bg-black/75 backdrop-blur-md"
                    onClick={() => setPlayMode(false)}
                  />

                  {/* Interactive stage */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 24 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 24 }}
                    transition={{ type: 'spring', stiffness: 240, damping: 26 }}
                    className="relative z-10 w-full max-w-[640px] rounded-3xl overflow-hidden border border-white/10"
                    style={{
                      background: 'linear-gradient(160deg, #141414, #0b0b0b)',
                      boxShadow: '0 30px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
                    }}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 pt-4 pb-2">
                      <div className="flex items-center gap-2 text-white">
                        <Gamepad2 className="w-4 h-4 text-primary" />
                        <span className="text-sm font-black tracking-tight">Play with Ori</span>
                        <span className="text-[10px] font-semibold text-white/40 hidden sm:inline">drag to rotate · scroll to zoom</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPlayMode(false)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black text-white/80 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" /> Exit
                      </button>
                    </div>

                    {/* Live 3D Ori — fully drag-rotatable; mood buttons let you play with it */}
                    <div className="relative w-full h-[52vh] max-h-[500px] min-h-[300px] pointer-events-auto">
                      <OriMascot
                        state={playMood}
                        className="w-full h-full"
                        preload={true}
                        interactive={true}
                        onOrbitChange={setOrbitCoords}
                      />
                      {/* Live rotation coordinates */}
                      <div className="pointer-events-none absolute top-3 left-3 flex gap-1.5 font-mono">
                        <span className="px-2 py-1 rounded-md text-[11px] font-bold text-primary bg-black/55 border border-white/10 backdrop-blur-sm">
                          yaw {orbitCoords.azimuthDeg}°
                        </span>
                        <span className="px-2 py-1 rounded-md text-[11px] font-bold text-primary bg-black/55 border border-white/10 backdrop-blur-sm">
                          pitch {orbitCoords.polarDeg}°
                        </span>
                      </div>
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent" />
                    </div>

                    {/* Mood controls */}
                    <div className="flex flex-wrap items-center justify-center gap-2 px-5 pb-5 pt-1">
                      {([
                        { mood: 'idle' as MascotState, img: 'ori-happy', label: 'Hi' },
                        { mood: 'curious' as MascotState, img: 'ori-curious', label: 'Curious' },
                        { mood: 'thinking' as MascotState, img: 'ori-thinking', label: 'Thinking' },
                        { mood: 'answering' as MascotState, img: 'ori-cheerful', label: 'Cheerful' },
                        { mood: 'success' as MascotState, img: 'ori-thubmsup', label: 'Yay' },
                      ]).map(({ mood, img, label }) => (
                        <button
                          key={mood}
                          type="button"
                          onClick={() => setPlayMood(mood)}
                          className={`flex items-center gap-1.5 pl-1.5 pr-3 py-1.5 rounded-full text-xs font-black border transition-all ${
                            playMood === mood
                              ? 'bg-primary text-white border-primary shadow-lg shadow-primary/30'
                              : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                          }`}
                        >
                          <img src={`/ori2d/${img}.png`} alt="" draggable={false} className="w-5 h-5 object-contain select-none" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </SmoothScroll>
  );
}