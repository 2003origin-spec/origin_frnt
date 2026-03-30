'use client';
import { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { Button } from '@/components/ui/button';
import FloatingLines from '@/components/ui/FloatingLines';
import GlassSurface from '@/components/ui/GlassSurface';
import CardSwap, { Card } from '@/components/ui/CardSwap';
import { useTheme } from 'next-themes';
import {
  MessageCircle,
  BarChart3,
  Users,
  Clock,
  Trophy,
  ChevronRight,
  CheckCircle2,
  Sun,
  Moon
} from 'lucide-react';

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

interface LandingPageProps {
  onGetStarted: () => void;
}

export default function LandingPage({ onGetStarted }: LandingPageProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  const howItWorksRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();

  const { scrollYProgress } = useScroll({
    target: howItWorksRef,
    offset: ["start center", "end center"]
  });

  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });



  // Quick helper for others? No, just verbose is fine for reliability.
  // Actually, let's use a simpler "Active Index" state derived from scroll?
  // No, `motion` is best for performance.


  // Transform for Step 1
  const step1Scale = useTransform(scrollYProgress, [0, 0.25], [1, 1.2]);
  const step1Opacity = useTransform(scrollYProgress, [0, 0.25], [0.5, 1]);
  const step1Border = useTransform(scrollYProgress, [0, 0.25], ["rgba(226, 232, 240, 0.5)", "rgba(59, 130, 246, 1)"]); // slate-200 to blue-500
  const step1Glow = useTransform(scrollYProgress, [0, 0.25], ["0px 0px 0px rgba(0,0,0,0)", "0px 0px 30px rgba(59, 130, 246, 0.3)"]);

  // Transform for Step 2
  const step2Scale = useTransform(scrollYProgress, [0.25, 0.5], [1, 1.2]);
  const step2Opacity = useTransform(scrollYProgress, [0.25, 0.5], [0.5, 1]);
  const step2Border = useTransform(scrollYProgress, [0.25, 0.5], ["rgba(226, 232, 240, 0.5)", "rgba(37, 99, 235, 1)"]); // slate-200 to blue-600
  const step2Glow = useTransform(scrollYProgress, [0.25, 0.5], ["0px 0px 0px rgba(0,0,0,0)", "0px 0px 30px rgba(37, 99, 235, 0.3)"]);

  // Transform for Step 3
  const step3Scale = useTransform(scrollYProgress, [0.5, 0.75], [1, 1.2]);
  const step3Opacity = useTransform(scrollYProgress, [0.5, 0.75], [0.5, 1]);
  const step3Border = useTransform(scrollYProgress, [0.5, 0.75], ["rgba(226, 232, 240, 0.5)", "rgba(29, 78, 216, 1)"]); // slate-200 to blue-700
  const step3Glow = useTransform(scrollYProgress, [0.5, 0.75], ["0px 0px 0px rgba(0,0,0,0)", "0px 0px 30px rgba(29, 78, 216, 0.3)"]);

  // Transform for Step 4
  const step4Scale = useTransform(scrollYProgress, [0.75, 1], [1, 1.2]);
  const step4Opacity = useTransform(scrollYProgress, [0.75, 1], [0.5, 1]);
  const step4Border = useTransform(scrollYProgress, [0.75, 1], ["rgba(226, 232, 240, 0.5)", "rgba(30, 58, 138, 1)"]); // slate-200 to blue-900
  const step4Glow = useTransform(scrollYProgress, [0.75, 1], ["0px 0px 0px rgba(0,0,0,0)", "0px 0px 30px rgba(30, 58, 138, 0.3)"]);

  const features = [
    {
      icon: () => <img src="/ai-bot.png" alt="AI" className="w-8 h-8 object-cover rounded-lg" />,
      title: 'Adaptive Intelligence',
      description: 'Tests that evolve with you. Our AI identifies your weak spots and adapts the difficulty in real-time.',
      video: '/videos/Adaptive-Intelligence.mp4'
    },
    {
      icon: MessageCircle,
      title: 'Instant Doubt Resolution',
      description: 'Stuck at 2 AM? Get detailed, step-by-step solutions instantly. No waiting, just learning.',
      video: '/videos/Instant-Doubt-Resolution.mp4'
    },
    {
      icon: BarChart3,
      title: 'Predictive Analytics',
      description: 'Know where you stand before the exam. track mastery and predict your AIR with 95% accuracy.',
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
  ];

  const stats = [
  { value: 'No Guesswork', label: '' },
  { value: 'Only Precision', label: '' },
  { value: 'Built for Results', label: '' },
];

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-slate-100 selection:bg-blue-500/30 font-sans transition-colors duration-300">

      {/* Ambient Background - Floating Lines */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-60 dark:opacity-100 transition-opacity">
        <FloatingLines
          linesGradient={theme === 'dark' ? ['#2563EB', '#1E40AF', '#1D4ED8', '#1E3A8A'] : ['#3b82f6', '#2563eb', '#1d4ed8', '#1e40af']}
          lineCount={[6, 8, 6]}
          lineDistance={[0.2, 0.3, 0.2]}
          parallaxStrength={0.1}
          animationSpeed={1.5}
          interactive={true}
          bendStrength={2.0}
          bendRadius={2.0}
        />
        {/* Vignette - Adjusted for Floating Lines visibility */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#ffffff_95%)] dark:bg-[radial-gradient(circle_at_center,transparent_0%,#000000_95%)]" />
      </div>

      {/* Navigation - Floating & Minimal */}
      <GlassSurface
        className="fixed top-6 left-0 right-0 mx-auto z-50 shadow-lg dark:shadow-2xl"
        borderRadius={9999}
        width="fit-content"
        distortionScale={0}
        displace={0}
        height="auto"
        opacity={0.5}
        blur={15}
        borderWidth={0}
      >
        <div className="px-6 py-2 flex items-center gap-6">
          <div className="flex items-center gap-2 pr-4 border-r border-slate-200 dark:border-white/5">
            <img
              src="/O3-Origin-Logo.png"
              alt="ORIGIN"
              className="h-8 w-auto"
            />
          </div>
          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm font-medium text-black/60 dark:text-slate-400 hover:text-black dark:hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm font-medium text-black/60 dark:text-slate-400 hover:text-black dark:hover:text-white transition-colors">How It Works</a>
            <a href="#pricing" className="text-sm font-medium text-black/60 dark:text-slate-400 hover:text-black dark:hover:text-white transition-colors">Pricing</a>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <Button
              onClick={onGetStarted}
              className="bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-200 rounded-full px-5 h-9 text-sm font-semibold transition-all hover:scale-105"
            >
              Get Started
            </Button>
          </div>
        </div>
      </GlassSurface>

      {/* Hero Section - Spacious & Bold */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center pt-24 pb-16 overflow-hidden z-10 px-4">
        <div className="max-w-5xl mx-auto text-center space-y-12">


          {/* Heading */}
          <h1 className="text-6xl sm:text-7xl lg:text-8xl font-medium text-black dark:text-white tracking-tight leading-[1.05] drop-shadow-2xl">
            Stop Studying More <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-400 dark:from-blue-400 dark:to-blue-200">
            Start Studying Right

            </span>
          </h1>

          {/* Subheading */}
          <p className="text-xl sm:text-2xl text-black/60 dark:text-slate-400 max-w-2xl mx-auto font-light leading-relaxed">
            Origin's AI doesn't give you more content — it tells you precisely what's costing you marks and fixes it.

         </p>
          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-7 pt-4">
            <Button
              onClick={onGetStarted}
              size="lg"
              className="rounded-full px-10 py-8 text-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 border-transparent shadow-lg hover:shadow-xl transition-all hover:scale-105"
            >
              Get Started
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="rounded-full px-10 py-8 text-lg border-2 border-slate-900 text-slate-900 hover:bg-slate-900 hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-slate-950 backdrop-blur-sm transition-all hover:scale-105"
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
            >
              See How It Works
            </Button>
          </div>

          {/* Social Proof */}
          <div className="pt-16 flex items-center justify-center gap-12 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-widest">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section - Glass Cards */}
      <section id="features" className="py-10 relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-12">
            <h2 className="text-4xl sm:text-5xl font-medium text-black dark:text-white mb-6 tracking-tight">
              Engineered for <span className="text-blue-600 dark:text-blue-400">Rankers</span>
            </h2>
            <p className="text-xl text-black/60 dark:text-slate-400 max-w-xl font-light leading-relaxed">
              Every feature is built with one goal: maximizing your marks <br /> per hour of study.
            </p>
          </div>

          <div className="flex justify-center items-center min-h-[10px] w-full relative">
            <CardSwap className="relative !transform-none !bottom-auto !right-auto mx-auto" width="450px" height="400px" verticalDistance={40} pauseOnHover={true}>
              {features.map((feature, index) => (
                <Card key={index} className="bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
                  {/* Tab Header */}
                  <div className="h-12 bg-white/5 border-b border-white/5 flex items-center px-4 gap-3 shrink-0">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                      <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
                    </div>
                    <span className="text-sm font-medium text-slate-400 ml-2 truncate">{feature.title}</span>
                  </div>

                  {/* Card Content */}
                  <div className="p-8 flex flex-col justify-center items-center text-center h-full">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4 text-white group-hover:scale-110 group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-all duration-500 overflow-hidden shrink-0">
                      <feature.icon />
                    </div>
                    <h3 className="text-xl font-medium text-white mb-2 shrink-0">{feature.title}</h3>
                    <p className="text-slate-300 leading-relaxed font-light text-sm mb-6 shrink-0">{feature.description}</p>

                    {/* Feature Video */}
                    <div className="w-full mt-auto rounded-xl overflow-hidden border border-white/10 group-hover:border-blue-500/50 transition-all duration-500 shadow-2xl relative h-32 shrink-0 group/video">
                      <div className="absolute inset-0 bg-blue-500/5 mix-blend-overlay z-10 group-hover/video:opacity-0 transition-opacity duration-500"></div>
                      <video
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover opacity-80 group-hover/video:opacity-100 group-hover/video:scale-105 transition-all duration-700"
                      >
                        <source src={feature.video} type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  </div>
                </Card>
              ))}
            </CardSwap>
          </div>
        </div>
      </section>

      {/* How It Works - Lenient Flow */}
      <section id="how-it-works" ref={howItWorksRef} className="py-10 relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-medium text-black dark:text-white mb-6">
              The Protocol
            </h2>
            <p className="text-xl text-black/60 dark:text-slate-400 max-w-2xl mx-auto font-light">
              A systematic approach to mastering the syllabus.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-12 relative">
            {/* Connecting Line - Animated */}
            <div className="hidden md:block absolute top-12 left-0 right-0 h-1 bg-slate-200 dark:bg-white/5 -z-10 rounded-full overflow-hidden">
              <motion.div
                style={{ scaleX, originX: 0 }}
                className="h-full w-full bg-gradient-to-r from-blue-400 via-blue-600 to-blue-900"
              />
            </div>

            {/* Step 1 */}
            <div className="relative group text-center">
              <motion.div
                style={{ scale: step1Scale, borderColor: step1Border, boxShadow: step1Glow }}
                className="w-24 h-24 mx-auto bg-white dark:bg-slate-950 border-2 rounded-full flex items-center justify-center text-slate-900 dark:text-white mb-8 z-10 relative transition-colors duration-500"
              >
                <PhaseStartIcon className="w-10 h-10" />
              </motion.div>
              <motion.div style={{ opacity: step1Opacity }}>
                <h3 className="text-2xl font-medium text-slate-900 dark:text-white mb-3">Diagnose</h3>
                <p className="text-slate-600 dark:text-slate-400 font-light text-lg">Identify gaps with AI tests.</p>
              </motion.div>
            </div>

            {/* Step 2 */}
            <div className="relative group text-center">
              <motion.div
                style={{ scale: step2Scale, borderColor: step2Border, boxShadow: step2Glow }}
                className="w-24 h-24 mx-auto bg-white dark:bg-slate-950 border-2 rounded-full flex items-center justify-center text-slate-900 dark:text-white mb-8 z-10 relative transition-colors duration-500"
              >
                <PhaseRunIcon className="w-10 h-10" />
              </motion.div>
              <motion.div style={{ opacity: step2Opacity }}>
                <h3 className="text-2xl font-medium text-slate-900 dark:text-white mb-3">Plan</h3>
                <p className="text-slate-600 dark:text-slate-400 font-light text-lg">Get a custom roadmap.</p>
              </motion.div>
            </div>

            {/* Step 3 */}
            <div className="relative group text-center">
              <motion.div
                style={{ scale: step3Scale, borderColor: step3Border, boxShadow: step3Glow }}
                className="w-24 h-24 mx-auto bg-white dark:bg-slate-950 border-2 rounded-full flex items-center justify-center text-slate-900 dark:text-white mb-8 z-10 relative transition-colors duration-500"
              >
                <PhaseSprintIcon className="w-10 h-10" />
              </motion.div>
              <motion.div style={{ opacity: step3Opacity }}>
                <h3 className="text-2xl font-medium text-slate-900 dark:text-white mb-3">Execute</h3>
                <p className="text-slate-600 dark:text-slate-400 font-light text-lg">Practice adaptive DPPs.</p>
              </motion.div>
            </div>

            {/* Step 4 */}
            <div className="relative group text-center">
              <motion.div
                style={{ scale: step4Scale, borderColor: step4Border, boxShadow: step4Glow }}
                className="w-24 h-24 mx-auto bg-white dark:bg-slate-950 border-2 rounded-full flex items-center justify-center text-slate-900 dark:text-white mb-8 z-10 relative transition-colors duration-500"
              >
                <PhaseAchieveIcon className="w-10 h-10" />
              </motion.div>
              <motion.div style={{ opacity: step4Opacity }}>
                <h3 className="text-2xl font-medium text-slate-900 dark:text-white mb-3">Achieve</h3>
                <p className="text-slate-600 dark:text-slate-400 font-light text-lg">Track rank improvements.</p>
              </motion.div>
            </div>

          </div>
        </div>
      </section>

      {/* Testimonials - Minimalist Cards */}
      <section className="py-10 relative z-10 w-full">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl sm:text-5xl font-medium text-slate-900 dark:text-white mb-8 leading-tight">
                Trusted by the <br />
                <span className="text-blue-600 dark:text-blue-400">Top 1%</span>.
              </h2>
              <p className="text-xl text-slate-600 dark:text-slate-400 font-light leading-relaxed mb-12">
                Join a community of serious aspirants who are rewriting their destiny with ORIGIN. The results speak for themselves.
              </p>
              <Button variant="outline" className="rounded-full px-8 py-6 border-slate-300 dark:border-white/10 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-white/5">
                Read Success Stories
              </Button>
            </div>

            <div className="grid gap-6">
              {[
                { name: "", rank: "coming soon", text: "coming soon" },
                { name: "", rank: "coming soon", text: "coming soon" },
                { name: "", rank: "coming soon", text: "coming soon" }
              ].map((t, i) => (
                <div key={i} className="p-8 rounded-[2rem] bg-blue-50/30 dark:bg-blue-950/10 border border-blue-100/50 dark:border-white/5 hover:bg-blue-100/30 dark:hover:bg-blue-900/10 transition-colors">
                  <p className="text-lg text-black/70 dark:text-slate-300 font-light mb-6">"{t.text}"</p>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-black dark:text-white">{t.name}</span>
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">{t.rank}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing - Premium Cards */}
      <section id="pricing" className="py-10 relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl sm:text-5xl font-medium text-slate-900 dark:text-white mb-6">
              Invest in Your Future
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto font-light">
              Simple pricing. No hidden costs. Cancel anytime.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              {
  name: 'Starter',
  price: 'Free',
  desc: 'Essential tools to get started.',
  features: [
    '5 AI Doubt Solves / Day',
    'Chapter-wise Tests',
    'Basic Weakness Report',
    'Formula Sheets',
    '5 DPPs / Week',
    'Community Access'
  ],
  cta: 'Start Free',
  popular: false
},
{
  name: 'Pro',
  price: 'Coming Soon',
  desc: 'For serious rank chasers.',
  features: [
    'Unlimited AI Doubt Solving',
    'Root Cause Error Analysis',
    'Unlimited Personalised DPPs',
    'Adaptive Mock Exams',
    'AI Rank Predictor',
    'Focus & Burnout Tracking',
    'Compete All-India',
    'Priority Support'
  ],
  cta: 'Notify Me',
  popular: true,
  comingSoon: true
},
{
  name: 'Elite',
  price: 'Coming Soon',
  desc: 'Full mentorship support.',
  features: [
    'Everything in Pro',
    'Teacher AI Agent Access',
    'Teacher-Style Explanations',
    'Custom Study Roadmap',
    'One-Click Chapter Revision',
    'EQ & Mental Wellness Tracking',
    'Parent Progress Reports',
    'Early Exam Pattern Predictions'
  ],
  cta: 'Notify Me',
  popular: false,
  comingSoon: true
},
            ].map((plan, index) => (
              <div
                key={index}
                className={`relative p-10 rounded-[2.5rem] flex flex-col ${plan.popular
                  ? 'bg-slate-800/80 border border-teal-500/30 shadow-2xl shadow-teal-900/20 scale-105 z-10'
                  : 'bg-white/60 dark:bg-slate-900/40 border border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10'
                  }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-1 rounded-full bg-blue-600 text-white text-xs font-bold uppercase tracking-wider">
                    Most Popular
                  </div>
                )}
                <div className="mb-8">
                  <h3 className={`text-xl font-medium mb-2 ${plan.popular ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{plan.name}</h3>
                  <div className={`text-4xl font-bold mb-4 ${plan.popular ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                    {plan.price}
                    {plan.price !== 'Free' && !plan.comingSoon && <span className={`text-lg font-normal ${plan.popular ? 'text-slate-300' : 'text-slate-500'}`}>/mo</span>}
                  </div>
                  <p className={`font-light ${plan.popular ? 'text-slate-300' : 'text-slate-600 dark:text-slate-400'}`}>{plan.desc}</p>
                </div>
                <div className="flex-grow space-y-4 mb-10">
                  {plan.features.map((f, i) => (
                    <div key={i} className={`flex items-center gap-3 font-light ${plan.popular ? 'text-slate-200' : 'text-slate-700 dark:text-slate-300'}`}>
                      <CheckCircle2 className={`w-5 h-5 ${plan.popular ? 'text-blue-400' : 'text-slate-500 dark:text-slate-600'}`} />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={onGetStarted}
                  className={`w-full py-7 rounded-2xl text-lg font-semibold transition-all ${plan.popular
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg'
                    : 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-white/20'
                    }`}
                >
                  {plan.cta}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA - Minimal & Bold */}
      <section className="py-10 relative z-10 overflow-hidden">
        <div className="absolute inset-0 bg-teal-900/10 -z-10 blur-3xl opacity-50" />
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-5xl sm:text-6xl font-medium text-slate-900 dark:text-white mb-10 tracking-tight leading-tight">
            Ready to rewrite your <br />
            <span className="text-blue-600 dark:text-blue-400">success story?</span>
          </h2>
          <Button
            onClick={onGetStarted}
            size="lg"
            className="bg-white text-slate-950 hover:bg-slate-200 rounded-full px-12 py-9 text-xl font-bold shadow-2xl transition-transform hover:scale-105"
          >
            Start Your Journey Now
          </Button>
        </div>
      </section>

      {/* Footer - Clean */}
      <footer className="py-12 relative z-10 text-center">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center opacity-50 hover:opacity-100 transition-opacity">
          <div className="mb-4 md:mb-0">
            <img src="/O3-Origin-Logo.png" alt="ORIGIN" className="h-6 w-auto" />
          </div>
          <div className="flex gap-8 text-sm text-slate-400">
            <a href="#" className="hover:text-white">Privacy</a>
            <a href="#" className="hover:text-white">Terms</a>
            <a href="#" className="hover:text-white">Contact</a>
          </div>
          <p className="text-sm text-slate-600 mt-4 md:mt-0">© 2026 ORIGIN Inc.</p>
        </div>
      </footer>
    </div>
  );
}
