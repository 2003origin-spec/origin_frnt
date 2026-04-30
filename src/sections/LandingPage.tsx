'use client';
import { useRef, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, useScroll, useTransform, useSpring, useInView } from 'framer-motion';
import { Button } from '@/components/ui/button';
import CrystalBackground from '@/components/ui/CrystalBackground';
import { Card } from '@/components/ui/CardSwap';

// Heavy graphics libs (three, gsap) — split into their own chunks so the
// landing shell can stream without paying the ~300 KB cost on first paint.
const FloatingLines = dynamic(() => import('@/components/ui/FloatingLines'), { ssr: false });
const CardSwap = dynamic(() => import('@/components/ui/CardSwap'), { ssr: false });
import { useTheme } from 'next-themes';
import {
  MessageCircle,
  BarChart3,
  Users,
  Clock,
  Trophy,
  Zap,
  Menu,
  X,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  Sun,
  Moon
} from 'lucide-react';
import { getRegistrationStatusAction } from '@/server/actions/system-actions';

const PhaseStartIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="16" cy="7" r="2" />
    <path d="M14 9 L10 11 L7 16 L9 20" />
    <path d="M10 11 L14 15 L17 14" />
    <path d="M14 9 L17 12" />
    <path d="M4 20 L20 20" />
  </svg>
);

const PhaseRunIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="13" cy="6" r="2" />
    <path d="M13 8 L12 13 L9 17L6 17" />
    <path d="M12 13 L15 16 L15 21" />
    <path d="M13 8 L10 11 L8 10" />
    <path d="M13 8 L16 9 L18 7" />
  </svg>
);

const PhaseSprintIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="15" cy="6" r="2" />
    <path d="M14 8 L11 13 L8 15 L5 14" />
    <path d="M11 13 L15 16 L13 21" />
    <path d="M14 8 L11 11 L8 10" />
    <path d="M14 8 L17 9 L20 7" />
    <path d="M2 10 L6 10" />
    <path d="M1 14 L4 14" />
    <path d="M3 18 L7 18" />
  </svg>
);

const PhaseAchieveIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7 L12 14" />
    <path d="M12 7 L9 10" />
    <path d="M12 7 L15 10" />
    <path d="M12 14 L9 19 L7 21" />
    <path d="M12 14 L15 19 L17 21" />
    <path d="M4 14 L20 14" strokeDasharray="3 3" />
  </svg>
);

const AnimatedCounter = ({ from, to, duration, inView }: { from: number; to: number; duration: number; inView: boolean }) => {
  const [count, setCount] = useState(from);

  useEffect(() => {
    if (!inView) return;

    let startTime: number | null = null;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      setCount(Math.floor(progress * (to - from) + from));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [from, to, duration, inView]);

  return <>{count}</>;
};

interface LandingPageProps {
  onGetStarted: () => void;
}

export default function LandingPage({ onGetStarted }: LandingPageProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  const howItWorksRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [regStatus, setRegStatus] = useState<{ count: number; limit: number; seatsLeft: number } | null>(null);
  const counterRef = useRef<HTMLDivElement>(null);
  const isCounterInView = useInView(counterRef, { once: true, amount: 0.5 });

  useEffect(() => {
    const fetchRegStatus = async () => {
      const status = await getRegistrationStatusAction();
      setRegStatus(status);
    };
    fetchRegStatus();
  }, []);

  useEffect(() => {
    setMounted(true);
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Determine actual rendered theme (handling 'system')
  const actualTheme = mounted
    ? resolvedTheme
    : (theme === 'system' ? 'dark' : theme);

  const { scrollYProgress } = useScroll({
    target: howItWorksRef,
    offset: ["start center", "end center"]
  });

  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  // Transform for Step 1
  const step1Scale = useTransform(scrollYProgress, [0, 0.25], [1, 1.2]);
  const step1Opacity = useTransform(scrollYProgress, [0, 0.25], [0.5, 1]);
  const step1Border = useTransform(scrollYProgress, [0, 0.25], ["rgba(226, 232, 240, 0.5)", "rgba(59, 130, 246, 1)"]);
  const step1Glow = useTransform(scrollYProgress, [0, 0.25], ["0px 0px 0px rgba(0,0,0,0)", "0px 0px 30px rgba(59, 130, 246, 0.3)"]);

  // Transform for Step 2
  const step2Scale = useTransform(scrollYProgress, [0.25, 0.5], [1, 1.2]);
  const step2Opacity = useTransform(scrollYProgress, [0.25, 0.5], [0.5, 1]);
  const step2Border = useTransform(scrollYProgress, [0.25, 0.5], ["rgba(226, 232, 240, 0.5)", "rgba(37, 99, 235, 1)"]);
  const step2Glow = useTransform(scrollYProgress, [0.25, 0.5], ["0px 0px 0px rgba(0,0,0,0)", "0px 0px 30px rgba(37, 99, 235, 0.3)"]);

  // Transform for Step 3
  const step3Scale = useTransform(scrollYProgress, [0.5, 0.75], [1, 1.2]);
  const step3Opacity = useTransform(scrollYProgress, [0.5, 0.75], [0.5, 1]);
  const step3Border = useTransform(scrollYProgress, [0.5, 0.75], ["rgba(226, 232, 240, 0.5)", "rgba(29, 78, 216, 1)"]);
  const step3Glow = useTransform(scrollYProgress, [0.5, 0.75], ["0px 0px 0px rgba(0,0,0,0)", "0px 0px 30px rgba(29, 78, 216, 0.3)"]);

  // Transform for Step 4
  const step4Scale = useTransform(scrollYProgress, [0.75, 1], [1, 1.2]);
  const step4Opacity = useTransform(scrollYProgress, [0.75, 1], [0.5, 1]);
  const step4Border = useTransform(scrollYProgress, [0.75, 1], ["rgba(203, 213, 225, 0.5)", "rgba(30, 58, 138, 1)"]);
  const step4Glow = useTransform(scrollYProgress, [0.75, 1], ["0px 0px 0px rgba(0,0,0,0)", "0px 0px 30px rgba(30, 58, 138, 0.3)"]);

  const features = [
    {
      icon: MessageCircle,
      title: 'Instant Doubt Resolution',
      description: 'Stuck at 2 AM? Get detailed, step-by-step solutions instantly. No waiting, just learning.',
      video: '/videos/Instant-Doubt-Resolution.mp4'
    },
    {
      icon: BarChart3,
      title: 'Predictive Analytics',
      description: 'Know where you stand before the exam. Track mastery and predict your AIR with 95% accuracy.',
      video: '/videos/Predictive-Analytics.mp4'
    },
    {
      icon: Users,
      title: 'IITian Mentorship',
      description: 'Direct guidance from those who have cracked it. Strategies, tips, and motivation from top rankers.',
      video: '/videos/IITian-Mentorship-2.mp4'
    },
    {
      icon: Clock,
      title: 'Pomodoro Focus',
      description: 'Built-in productivity tools. Study smarter with scientifically proven focus timers and break intervals.',
      video: '/videos/Pomodoro-Focus.mp4'
    },
    {
      icon: Trophy,
      title: 'Gamified Growth',
      description: 'Make preparation addictive. Earn streaks, unlock badges, and climb the leaderboard daily.',
      video: '/videos/Gamified-Growth.mp4'
    },
    {
      icon: () => <img src="/ai-bot.png" alt="AI" className="w-8 h-8 object-cover rounded-lg" />,
      title: 'Adaptive Intelligence',
      description: 'Tests that evolve with you. Our AI identifies your weak spots and adapts the difficulty in real-time.',
      video: '/videos/Adaptive-Intelligence.mp4'
    },
  ];

  const stats = [
    { value: 'No Guesswork', label: 'Data-Driven Learning' },
    { value: 'Only Precision', label: 'Targeted Practice' },
    { value: 'Built for Results', label: 'Proven Framework' },
  ];

  // Helper to render a feature card (used both in rotating and grid modes)
  const FeatureCard = ({ feature }: { feature: typeof features[0] }) => (
    <div className="premium-card p-0 overflow-hidden ring-1 ring-border/50 bg-card/80 backdrop-blur-xl h-full flex flex-col">
      {/* Tab Header */}
      <div className="h-14 bg-muted/30 border-b border-border/50 flex items-center px-6 gap-3 shrink-0">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-red-400/40" />
          <div className="w-3 h-3 rounded-full bg-amber-400/40" />
          <div className="w-3 h-3 rounded-full bg-emerald-400/40" />
        </div>
        <span className="text-[10px] font-black text-muted-foreground/60 ml-4 uppercase tracking-[0.2em] truncate">
          {feature.title}
        </span>
      </div>

      {/* Card Content */}
      <div className="p-6 sm:p-10 flex flex-col justify-center items-start text-left h-full">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 sm:mb-8 text-primary shadow-lg shadow-primary/5 shrink-0 ring-1 ring-primary/20">
          <feature.icon className="w-6 h-6 sm:w-8 sm:h-8" />
        </div>
        <h3 className="text-xl sm:text-2xl font-black text-foreground mb-3 sm:mb-4 tracking-tight">
          {feature.title}
        </h3>
        <p className="text-sm sm:text-base text-foreground/70 leading-relaxed font-medium mb-6 sm:mb-8">
          {feature.description}
        </p>

        {/* Feature Preview */}
        <div className="w-full mt-auto rounded-2xl overflow-hidden border border-border bg-background group-hover:border-primary/30 transition-all duration-500 shadow-2xl relative h-28 sm:h-36 shrink-0 group/video">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent z-10" />
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-700"
            poster="/video-poster.jpg"
          >
            <source src={feature.video} type="video/mp4" />
          </video>
          <div className="absolute bottom-2 right-2 glass p-1.5 sm:p-2 rounded-lg z-20 opacity-0 group-hover:opacity-100 transition-opacity">
            <Zap className="w-3 h-3 text-primary animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 font-sans transition-colors duration-1000 relative overflow-x-hidden">
      {/* Dynamic Background Ambient Decorations */}
      <div className="fixed inset-0 z-0 pointer-events-none hidden dark:block">
        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[0%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[100px]" />
        <div className="absolute top-[30%] left-[20%] w-[30%] h-[30%] bg-indigo-500/5 rounded-full blur-[100px]" />
      </div>

      {/* Floating Lines - Dark */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40 hidden dark:block">
        <FloatingLines
          linesGradient={['#2563eb', '#1e40af', '#1d4ed8']}
          lineCount={[4, 6, 4]}
          animationSpeed={1.0}
          interactive={true}
        />
      </div>

      {/* Floating Lines - Light */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-20 transition-opacity duration-1000 block dark:hidden">
        <FloatingLines
          linesGradient={['#2563eb', '#3b82f6', '#60a5fa']}
          lineCount={[4, 6, 4]}
          animationSpeed={0.8}
          interactive={true}
        />
      </div>

      {/* Crystalline Light Theme Background */}
      <div className="block dark:hidden">
        <CrystalBackground />
      </div>

      {/* Navigation - Unified Crystal Glass Design */}
      <nav className="fixed top-8 left-0 right-0 mx-auto z-50 flex justify-center px-4">
        <div className="bg-white/60 dark:bg-black/20 backdrop-blur-xl px-2 py-2 rounded-full flex items-center justify-between lg:justify-center gap-4 lg:gap-12 shadow-[0_8px_32px_rgba(0,0,0,0.05)] border border-white/80 dark:border-white/10 ring-1 ring-black/[0.03] w-full max-w-fit md:w-auto transition-all duration-500 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center">
              <img
                src="/origin-new.jpg"
                alt="ORIGIN"
                className="h-9 w-auto rounded-lg object-contain"
              />
            </div>
          </div>

          {/* Desktop Links */}
          <div className="hidden lg:flex items-center gap-10 px-4">
            <a href="#features" className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground/60 hover:text-foreground transition-all duration-300">
              Features
            </a>
            <a href="#how-it-works" className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground/60 hover:text-foreground transition-all duration-300">
              Protocol
            </a>
            <a href="#pricing" className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground/60 hover:text-foreground transition-all duration-300">
              Pricing
            </a>
          </div>

          <div className="flex items-center gap-2 lg:gap-4 pr-1">
            {/* Desktop Theme Toggle */}
            <button
              onClick={() => setTheme(actualTheme === 'dark' ? 'light' : 'dark')}
              className="hidden lg:flex p-2 text-foreground/40 hover:text-foreground transition-all duration-300"
              aria-label="Toggle Theme"
            >
              {mounted && (actualTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />)}
            </button>

            {/* CTA Button - Responsive Width */}
            <Button
              onClick={onGetStarted}
              className="bg-blue-600 dark:bg-white text-white dark:text-black hover:bg-blue-700 dark:hover:bg-white/90 rounded-full px-6 lg:px-10 h-10 lg:h-12 text-[10px] lg:text-[11px] uppercase tracking-[0.2em] font-black transition-all duration-300 shadow-lg shadow-blue-500/20 active:scale-95"
            >
              Join Now
            </Button>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-foreground/60 hover:text-foreground"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed inset-0 z-[45] bg-white/95 dark:bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-8 lg:hidden"
        >
          <div className="flex flex-col items-center gap-12 w-full max-w-sm">
            {[
              { name: 'Features', href: '#features' },
              { name: 'Protocol', href: '#how-it-works' },
              { name: 'Pricing', href: '#pricing' }
            ].map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-4xl font-black uppercase tracking-[0.2em] text-foreground hover:text-primary transition-all active:scale-95"
              >
                {link.name}
              </a>
            ))}

            <div className="h-px w-full bg-border/50" />

            <div className="flex items-center justify-between w-full px-8">
              <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Theme</span>
              <button
                onClick={() => setTheme(actualTheme === 'dark' ? 'light' : 'dark')}
                className="flex items-center gap-3 px-6 py-3 rounded-full border border-border/50 text-foreground font-black text-xs uppercase tracking-widest bg-muted/30"
              >
                {mounted ? (actualTheme === 'dark' ? (
                  <>
                    <Sun className="w-4 h-4" /> Light
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4" /> Dark
                  </>
                )) : <><Moon className="w-4 h-4" /> Dark</>}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Hero Section - Enhanced with Animation */}
      <section ref={heroRef} className="relative min-h-[90vh] flex items-center justify-center pt-32 pb-16 overflow-hidden z-10 px-4">
        <div className="max-w-6xl mx-auto text-center space-y-12">
          {/* Hero Branding - CSS Managed Visibility */}
          <div className="hidden dark:flex flex-col items-center space-y-12">
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-6xl lg:text-[7rem] font-black text-white tracking-[-0.04em] leading-[0.9] animate-slide-up flex flex-col items-center">
                <span>The Topper Knew Something</span>
                <span className="text-blue-400 text-3xl sm:text-5xl lg:text-[5rem] mt-4 tracking-tighter">You didn't. Now you do.</span>
              </h1>
            </div>
            <p className="text-lg sm:text-xl md:text-2xl text-slate-400 max-w-2xl mx-auto font-light leading-relaxed tracking-tight animate-fade-in delay-300 px-4">
              Crack Every Competitive Exams with Unfare Precision using A.I.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 pt-8 animate-slide-up delay-500 w-full px-6">
              <Button onClick={onGetStarted} size="lg" className="w-full sm:w-auto rounded-full px-10 py-8 text-xl bg-blue-600 text-white hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all hover:scale-105 font-bold uppercase tracking-widest">
                Join Origin
              </Button>
              <Button variant="outline" size="lg" className="w-full sm:w-auto rounded-full px-10 py-8 text-xl border-white/10 text-white hover:bg-white/5 transition-all hover:scale-105 font-bold" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
                Learn More
              </Button>
            </div>
          </div>

          <div className="flex dark:hidden flex-col items-center space-y-12">
            <div className="space-y-6">
              {regStatus && regStatus.seatsLeft > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-600 shadow-sm mb-4"
                >
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">Limited Access: {regStatus.seatsLeft} Seats Left</span>
                </motion.div>
              )}
              <h1 className="text-4xl sm:text-6xl lg:text-[7.5rem] font-black tracking-[-0.05em] leading-[0.9] animate-slide-up flex flex-col items-center drop-shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                <span className="text-slate-900">The Topper Knew Something</span>
                <span className="text-blue-600 text-3xl sm:text-5xl lg:text-[5.5rem] mt-4 tracking-tighter drop-shadow-none">You didn't. Now you do.</span>
              </h1>
            </div>

            <p className="text-lg sm:text-xl md:text-2xl text-slate-500 max-w-2xl mx-auto font-medium leading-relaxed tracking-tight animate-fade-in delay-300 px-4">
              Premium data-driven prep for elite students. <br className="hidden sm:block" /> Stop guessing, start mastering.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 pt-8 animate-slide-up delay-500 w-full px-6">
              <Button onClick={onGetStarted} size="lg" className="w-full sm:w-auto rounded-full px-12 py-10 text-xl bg-blue-600 text-white hover:bg-blue-700 shadow-[0_20px_40px_rgba(37,99,235,0.25)] transition-all hover:scale-105 group font-black uppercase tracking-widest active:scale-95">
                Join Origin
                <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button variant="outline" size="lg" className="w-full sm:w-auto rounded-full px-12 py-10 text-xl border-2 border-slate-200 text-slate-900 hover:bg-slate-50 hover:border-slate-300 transition-all hover:scale-105 font-black uppercase tracking-widest active:scale-95" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
                Explore Protocol
              </Button>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="pt-24 flex flex-wrap items-center justify-center gap-12 md:gap-20"
          >
            {stats.map((stat, i) => (
              <div key={i} className="text-center group">
                <div className="text-3xl font-black text-foreground mb-2 group-hover:scale-110 transition-transform tracking-tight">
                  {stat.value}
                </div>
                <div className="text-[10px] font-black text-foreground/60 dark:text-muted-foreground uppercase tracking-[0.3em]">
                  {stat.label}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section - Responsive: Rotating cards on desktop, simple grid on mobile */}
      <section id="features" className="py-24 lg:py-32 relative z-10 overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-[10px] font-black text-primary tracking-[0.4em] uppercase mb-4">
              Core Capabilities
            </h2>
            <h1 className="text-6xl sm:text-6xl lg:text-8xl font-black text-foreground mb-8 tracking-tighter">
              Engineered for <span className="text-gradient">Rankers.</span>
            </h1>
          </motion.div>

          {/* Mobile: Simple grid of cards */}
          {isMobile ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {features.map((feature, idx) => (
                <FeatureCard key={idx} feature={feature} />
              ))}
            </div>
          ) : (
            <div className="flex justify-center items-center min-h-[520px] w-full relative">
                <CardSwap
                  className="relative !transform-none !bottom-auto !right-auto mx-auto"
                  width="500px"
                  height="500px"
                  verticalDistance={40}
                  pauseOnHover={true}
                >
                  {features.map((feature, index) => (
                    <Card key={index} className="premium-card p-0 overflow-hidden ring-1 ring-border/50 bg-card/80 backdrop-blur-xl">
                      {/* Tab Header */}
                      <div className="h-14 bg-muted/30 border-b border-border/50 flex items-center px-6 gap-3 shrink-0">
                        <div className="flex gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-400/40" />
                          <div className="w-3 h-3 rounded-full bg-amber-400/40" />
                          <div className="w-3 h-3 rounded-full bg-emerald-400/40" />
                        </div>
                        <span className="text-[10px] font-black text-muted-foreground/60 ml-4 uppercase tracking-[0.2em] truncate">
                          {feature.title}
                        </span>
                      </div>

                      {/* Card Content */}
                      <div className="p-6 sm:p-10 flex flex-col justify-center items-start text-left h-full">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 sm:mb-8 text-primary shadow-lg shadow-primary/5 shrink-0 ring-1 ring-primary/20">
                          <feature.icon className="w-6 h-6 sm:w-8 sm:h-8" />
                        </div>
                        <h3 className="text-xl sm:text-2xl font-black text-foreground mb-3 sm:mb-4 tracking-tight">
                          {feature.title}
                        </h3>
                        <p className="text-sm sm:text-base text-foreground/70 leading-relaxed font-medium mb-6 sm:mb-8">
                          {feature.description}
                        </p>

                        {/* Feature Preview */}
                        <div className="w-full mt-auto rounded-2xl overflow-hidden border border-border bg-background group-hover:border-primary/30 transition-all duration-500 shadow-2xl relative h-28 sm:h-36 shrink-0 group/video">
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent z-10" />
                          <video
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-700"
                            poster="/video-poster.jpg"
                          >
                            <source src={feature.video} type="video/mp4" />
                          </video>
                          <div className="absolute bottom-2 right-2 glass p-1.5 sm:p-2 rounded-lg z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Zap className="w-3 h-3 text-primary animate-pulse" />
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </CardSwap>
            </div>
          )}
        </div>
      </section>

      {/* The Protocol Section - Zigzag Layout with High-Impact Visuals */}
      <section id="how-it-works" ref={howItWorksRef} className="py-24 lg:py-40 relative z-10 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            viewport={{ once: true }}
            className="text-center mb-32"
          >
            <h2 className="text-[10px] font-black text-primary tracking-[0.5em] uppercase mb-6">
              Mastery Framework
            </h2>
            <h1 className="text-6xl sm:text-7xl lg:text-9xl font-black text-foreground mb-8 tracking-tighter">
              The <span className="text-gradient">Protocol.</span>
            </h1>
            <p className="text-xl sm:text-2xl text-muted-foreground max-w-3xl mx-auto font-medium leading-relaxed tracking-tight">
              A systematic, AI-driven approach to mastering the syllabus and securing your top rank.
            </p>
          </motion.div>

          <div className="space-y-40 lg:space-y-64 relative">
            {/* Step 1: Diagnose */}
            <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-32">
              <motion.div 
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                viewport={{ once: true, margin: "-100px" }}
                className="flex-1 space-y-8"
              >
                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary">
                  <span className="text-xs font-black uppercase tracking-widest">Step 01</span>
                </div>
                <h2 className="text-5xl lg:text-7xl font-black text-slate-900 tracking-tighter">
                  Diagnose.
                </h2>
                <p className="text-xl lg:text-2xl text-slate-500 leading-relaxed font-medium">
                  Identify critical knowledge gaps with hyper-precise AI diagnostic tests. Our AI maps your cognitive profile in real-time.
                </p>
                <ul className="space-y-4 pt-4">
                  {[
                    "Real-time gap detection",
                    "Cognitive strength mapping",
                    "Syllabus coverage audit"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-foreground/80 font-bold">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, rotate: 2 }}
                whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
                className="flex-1 relative group"
              >
                <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full group-hover:bg-primary/30 transition-colors duration-700 dark:block hidden" />
                <div className="relative rounded-[2.5rem] overflow-hidden border-4 border-white dark:border-white/10 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.12)] dark:shadow-2xl">
                  <img src="/images/protocol/diagnose.png" alt="Diagnose" className="w-full h-auto object-cover hover:scale-105 transition-transform duration-1000" />
                </div>
              </motion.div>
            </div>

            {/* Step 2: Plan */}
            <div className="flex flex-col lg:flex-row-reverse items-center gap-16 lg:gap-32">
              <motion.div 
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                viewport={{ once: true, margin: "-100px" }}
                className="flex-1 space-y-8"
              >
                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500">
                  <span className="text-xs font-black uppercase tracking-widest">Step 02</span>
                </div>
                <h2 className="text-5xl lg:text-7xl font-black text-slate-900 tracking-tighter">
                  Plan.
                </h2>
                <p className="text-xl lg:text-2xl text-slate-500 leading-relaxed font-medium">
                  Get a custom roadmap generated by our AIR prediction engine. Every hour of study is optimized for maximum mark gains.
                </p>
                <ul className="space-y-4 pt-4">
                  {[
                    "Personalized path to AIR < 100",
                    "Dynamic subject re-prioritization",
                    "Time-blocked efficiency maps"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-foreground/80 font-bold">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
                whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
                className="flex-1 relative group"
              >
                <div className="absolute inset-0 bg-blue-500/20 blur-[100px] rounded-full group-hover:bg-blue-500/30 transition-colors duration-700 dark:block hidden" />
                <div className="relative rounded-[2.5rem] overflow-hidden border-4 border-white dark:border-white/10 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.12)] dark:shadow-2xl">
                  <img src="/images/protocol/plan.png" alt="Plan" className="w-full h-auto object-cover hover:scale-105 transition-transform duration-1000" />
                </div>
              </motion.div>
            </div>

            {/* Step 3: Execute */}
            <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-32">
              <motion.div 
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                viewport={{ once: true, margin: "-100px" }}
                className="flex-1 space-y-8"
              >
                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-500">
                  <span className="text-xs font-black uppercase tracking-widest">Step 03</span>
                </div>
                <h2 className="text-5xl lg:text-7xl font-black text-slate-900 tracking-tighter">
                  Execute.
                </h2>
                <p className="text-xl lg:text-2xl text-slate-500 leading-relaxed font-medium">
                  Practice with adaptive DPPs that evolve as you solve. No two students ever solve the same question set.
                </p>
                <ul className="space-y-4 pt-4">
                  {[
                    "Infinite adaptive problem sets",
                    "Hyper-focused doubt resolution",
                    "Scientifically designed focus blocks"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-foreground/80 font-bold">
                      <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, rotate: 2 }}
                whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
                className="flex-1 relative group"
              >
                <div className="absolute inset-0 bg-teal-500/20 blur-[100px] rounded-full group-hover:bg-teal-500/30 transition-colors duration-700 dark:block hidden" />
                <div className="relative rounded-[2.5rem] overflow-hidden border-4 border-white dark:border-white/10 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.12)] dark:shadow-2xl">
                  <img src="/images/protocol/execute.png" alt="Execute" className="w-full h-auto object-cover hover:scale-105 transition-transform duration-1000" />
                </div>
              </motion.div>
            </div>

            {/* Step 4: Achieve */}
            <div className="flex flex-col lg:flex-row-reverse items-center gap-16 lg:gap-32">
              <motion.div 
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                viewport={{ once: true, margin: "-100px" }}
                className="flex-1 space-y-8"
              >
                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500">
                  <span className="text-xs font-black uppercase tracking-widest">Step 04</span>
                </div>
                <h2 className="text-5xl lg:text-7xl font-black text-slate-900 tracking-tighter">
                  Achieve.
                </h2>
                <p className="text-xl lg:text-2xl text-slate-500 leading-relaxed font-medium">
                  Track your rank improvements daily. See your predicted AIR rise as you master more concepts.
                </p>
                <ul className="space-y-4 pt-4">
                  {[
                    "Daily AIR prediction updates",
                    "Milestone celebration engine",
                    "Final sprint optimization"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-foreground/80 font-bold">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
                whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
                className="flex-1 relative group"
              >
                <div className="absolute inset-0 bg-amber-500/20 blur-[100px] rounded-full group-hover:bg-amber-500/30 transition-colors duration-700 dark:block hidden" />
                <div className="relative rounded-[2.5rem] overflow-hidden border-4 border-white dark:border-white/10 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.12)] dark:shadow-2xl">
                  <img src="/images/protocol/achieve.png" alt="Achieve" className="w-full h-auto object-cover hover:scale-105 transition-transform duration-1000" />
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials - Simplified & Centered */}
      <section className="py-24 lg:py-40 relative z-10 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <motion.div
            ref={counterRef}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="flex flex-col items-center space-y-10"
          >
            <h2 className="text-5xl sm:text-7xl lg:text-9xl font-black text-foreground tracking-tighter leading-none">
              Trusted by the <br />
              <span className="text-gradient">Top 1%.</span>
            </h2>
            <p className="text-xl sm:text-2xl text-muted-foreground max-w-3xl mx-auto font-black leading-relaxed tracking-tight uppercase">
              <span className="text-primary text-4xl sm:text-6xl md:text-8xl block mb-6 font-black tabular-nums">
                <AnimatedCounter from={1} to={12620} duration={10} inView={isCounterInView} />+
              </span>
              QUESTIONS To Practice FROM NCERT, PYQS, AND Famous Books for JEE and NEET Preparation
            </p>

            <motion.a
              href="https://chat.whatsapp.com/BBwpKNeiCypGzeVMwsw9ns?mode=gi_t"
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-4 px-10 py-5 bg-[#25D366] text-white rounded-full font-black text-lg shadow-2xl shadow-green-500/30 hover:shadow-green-500/50 transition-all duration-300 group"
            >
              <div className="w-8 h-8 flex items-center justify-center bg-white rounded-full p-1.5 group-hover:rotate-12 transition-transform">
                <svg className="w-full h-full text-[#25D366]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.938 3.659 1.434 5.628 1.435h.006c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
              </div>
              Join O3 Minds Community
            </motion.a>
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 lg:py-32 relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-[10px] font-black text-primary tracking-[0.4em] uppercase mb-4">Pricing Plans</h2>
            <h2 className="text-4xl sm:text-5xl lg:text-7xl font-black text-foreground mb-8 tracking-tighter">
              Invest in <span className="text-gradient">Your Future.</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-medium leading-relaxed tracking-tight">
              Elite training shouldn't be a luxury. Choose the track that fits your ambition.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              {
                name: 'Starter',
                price: 'Free',
                desc: 'Atomic building blocks for serious aspirants.',
                features: [
                  '5 AI Research Cycles / Day',
                  'Core Subject Benchmarks',
                  'Fundamental Gap Analysis',
                  'Curated Resource Hub',
                  'Community Access'
                ],
                cta: 'Start Now',
                popular: false
              },
              {
                name: 'Pro',
                price: 'Waitlist',
                desc: 'The complete performance architecture.',
                features: [
                  'Unlimited AI Research',
                  'Cognitive Failure Analysis',
                  'Dynamic Personalized Paths',
                  'Adaptive Arena Access',
                  'Rank Improvement Metrics',
                  'Focus & Velocity Tracking',
                  'Elite Community Access',
                  'Priority Support'
                ],
                cta: 'Join Waitlist',
                popular: true,
                comingSoon: true
              },
              {
                name: 'Elite',
                price: 'Waitlist',
                desc: '1-on-1 performance engineering.',
                features: [
                  'Everything in Pro',
                  'Personal AI Tutor Agent',
                  'Mastery-Based Explanations',
                  'End-to-End Milestone Maps',
                  'Rapid Revision Protocols',
                  'Mental Performance Gear',
                  'Advanced Predictive Ops'
                ],
                cta: 'Join Waitlist',
                popular: false,
                comingSoon: true
              },
            ].map((plan, index) => (
              <div
                key={index}
                className={`relative p-10 flex flex-col transition-all duration-500 hover:scale-[1.02] ${plan.popular
                  ? 'premium-card bg-card text-foreground border-2 border-primary shadow-[0_40px_80px_rgba(37,99,235,0.15)] dark:border-primary/50'
                  : 'premium-card glass bg-card dark:bg-card/40 backdrop-blur-xl border border-border'
                  }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-5 py-2 rounded-full bg-primary text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl">
                    Most Strategic
                  </div>
                )}
                <div className="mb-10">
                  <h3 className="text-2xl font-black mb-2 tracking-tight text-foreground">{plan.name}</h3>
                  <div className="text-5xl font-black mb-6 tracking-tighter text-foreground">
                    {plan.price}
                  </div>
                  <p className="text-sm font-black leading-relaxed text-foreground/70 dark:text-muted-foreground">{plan.desc}</p>
                </div>
                <div className="flex-grow space-y-5 mb-12">
                  {plan.features.map((f, i) => (
                    <div key={i} className="flex items-start gap-3 font-bold text-xs text-foreground/80">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={onGetStarted}
                  className={`w-full py-8 rounded-2xl text-[11px] uppercase tracking-[0.2em] font-black transition-all duration-300 ${plan.popular
                    ? 'bg-primary text-white hover:bg-primary/90 shadow-2xl'
                    : 'bg-muted text-foreground hover:bg-muted/80'
                    }`}
                >
                  {plan.cta}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA - Enhanced Minimal & Bold */}
      <section className="py-24 lg:py-32 relative z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-teal-500/10 to-blue-500/10 dark:from-blue-500/5 dark:via-teal-500/5 dark:to-blue-500/5 -z-10 blur-3xl" />
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="space-y-10"
          >
            <h2 className="text-6xl sm:text-8xl lg:text-[10rem] font-black text-foreground tracking-tighter leading-[0.8] mb-12">
              REWRITE YOUR <br />
              <span className="text-gradient">STORY.</span>
            </h2>

            <div className="flex flex-col items-center gap-8">
              <div className="bg-primary/10 border border-primary/20 px-6 py-2 rounded-full">
                <p className="text-sm sm:text-base font-black tracking-[0.2em] text-primary uppercase animate-pulse">
                  {regStatus 
                    ? `⚠️ ${regStatus.seatsLeft > 0 ? `Only ${regStatus.seatsLeft} Seats Left` : 'Capacity Reached'}` 
                    : '⚠️ Limited Seats Remaining'}
                </p>
              </div>

              <Button
                onClick={onGetStarted}
                size="sm"
                className="bg-primary text-white hover:bg-primary/90 rounded-full px-12 py-10 text-2xl font-black shadow-[0_20px_60px_rgba(37,99,235,0.3)] transition-all duration-300 hover:scale-105 group"
              >
                START YOUR JOURNEY
                <Zap className="w-6 h-6 ml-2 group-hover:rotate-12 transition-transform fill-current" />
              </Button>

              <p className="text-lg sm:text-xl text-muted-foreground font-black tracking-tight uppercase">
                Join Success journey with <span className="text-foreground border-b-4 border-primary/30">O3 Minds</span>
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer - Minimalist & Geometric */}
      <footer className="py-10 relative z-10 border-t border-border/50 bg-background/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center md:items-end justify-between gap-12">
          <div className="flex flex-col items-center md:items-start gap-3">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em]">© O3 Minds</span>
            <img src="/origin-new.jpg" alt="ORIGIN" className="h-12 w-auto dark:brightness-110" />
          </div>

          <div className="flex flex-col items-center md:items-end gap-6">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em]">Connect With Us</span>
            <div className="flex gap-6 items-center">
              <a href="https://chat.whatsapp.com/BBwpKNeiCypGzeVMwsw9ns?mode=gi_t" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform duration-200">
                <img src="/images/SocialMedia/Whatsapp-Logo.png" alt="WhatsApp" className="h-12 w-auto" />
              </a>
              <a href="https://www.linkedin.com/in/o3-origin-ba73233a8/" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform duration-200">
                <img src="/images/SocialMedia/LinkedIn.png" alt="LinkedIn" className="h-12 w-auto" />
              </a>
              <a href="https://x.com/O3_origin" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform duration-200">
                <img src="/images/SocialMedia/X.jpg" alt="X" className="h-12 w-auto rounded-md" />
              </a>
              <a href="https://www.instagram.com/o3.origin/?hl=en" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform duration-200">
                <img src="/images/SocialMedia/Instagram.png" alt="Instagram" className="h-12 w-auto" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}