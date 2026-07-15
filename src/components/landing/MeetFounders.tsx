'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

const FOUNDERS = [
  {
    name: 'Dipraj Biswas', role: 'CEO & Co-Founder', edu: 'NIT Agartala', photo: '/Develpers/Dipraj.png',
    points: ['Product Dev at 2 Shark Tank-funded startups', 'Board of Director, E-Cell NIT Agartala', 'Mentored 100+ students', 'AI × education × student psychology'],
  },
  {
    name: 'Ayush Paul', role: 'CTO & Co-Founder', edu: 'IIT Madras · B.S. Data Science', photo: '/Develpers/Ayush.png',
    points: ['AI Engineer & Backend System Orchestrator', 'AI/ML architecture & LLMs', '5-layer O3Origin AI context stack', 'Python FastAPI learning engine'],
  },
  {
    name: 'Tohin Majumder', role: 'CFO & Ed-Tech Dev', edu: 'Sharda University', photo: '/Develpers/Tohin.png',
    points: ['Ex-AI Researcher — IIT Tirupati', 'System Design & Backend Dev — O3Origin', 'Ex-Senior Dev — Unimonks', 'Worked at StudyTable'],
  },
  {
    name: 'S Naveen', role: 'COO & Full-Stack Developer', edu: 'CSE Researcher @ IIT Madras', photo: '/Develpers/S-Naveen.png',
    points: ['CSE Researcher — IIT Madras', 'B.Tech CSE — IIIT Manipur', 'VP — IIIT Manipur', 'Full-stack developer (Frontend & UI/UX)'],
  },
];

export default function MeetFounders() {
  return (
    <main className="min-h-dvh neu-surface font-sans">
      <div className="w-full px-5 sm:px-8 lg:px-12 xl:px-16 py-8 sm:py-14 lg:py-20">
        {/* Back to home */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> Back to home
        </Link>

        {/* Heading + story */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10 sm:mb-14"
        >
          <div className="inline-flex items-center gap-2 neu-inset px-4 py-2 rounded-full mb-5 sm:mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <h2 className="text-[10px] font-heading font-black text-primary tracking-[0.4em] uppercase">The Team</h2>
          </div>
          <h1 className="text-4xl xs:text-5xl sm:text-7xl lg:text-8xl font-heading font-black mb-4 sm:mb-6 tracking-tighter leading-[0.95] whitespace-nowrap">
            <span className="text-outline">The Minds Behind</span>{' '}
            <span className="bg-gradient-to-r from-primary via-primary/90 to-primary bg-clip-text text-transparent">O3Origin.</span>
          </h1>

          <div className="w-full space-y-5 text-left">
            <h2 className="text-2xl sm:text-4xl font-heading font-black tracking-tight text-foreground text-center mb-2">
              The Origin of <span className="text-primary">O3Origin</span>
            </h2>
            <p className="text-base sm:text-lg text-foreground/90 leading-relaxed text-center italic">
              Every startup begins with a problem. Ours began with a student.
            </p>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
              From the time he was in Class 6, <span className="font-bold text-foreground">Dipraj Biswas</span> dreamed of doing something
              meaningful with his life. Like millions of students across India, he believed that cracking the IIT entrance exam was the path
              to achieving that dream. He started his IIT Foundation preparation early and worked relentlessly.
            </p>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
              By Class 9, he had completed the entire Class 11 syllabus. By Class 10, he had finished Class 12. He studied harder than most,
              sacrificing countless hours with one goal in mind.
            </p>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
              But when he finally entered Classes 11 and 12, something unexpected happened. Despite years of hard work, the results didn&apos;t
              reflect the effort. The problem wasn&apos;t dedication — it was <span className="font-bold text-foreground">direction</span>.
            </p>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
              There was no personalized system, no one to tell him what he actually needed to improve, and no way to understand
              <span className="italic"> why</span> he was losing marks. Like many aspirants, he believed toppers knew something that everyone else didn&apos;t.
            </p>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
              Eventually, Dipraj secured admission to <span className="font-bold text-foreground">NIT Agartala</span>. While he was grateful for
              the opportunity, one question never left him:
            </p>
            <blockquote className="neu-inset rounded-2xl px-5 py-4 text-center text-lg sm:text-xl font-heading font-black text-foreground">
              &ldquo;What if every student had access to the guidance I was missing?&rdquo;
            </blockquote>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
              Around the same time, his school friend, <span className="font-bold text-foreground">Ayush Paul</span>, shared a similar vision.
              He, too, believed that education should be more accessible, personalized, and empowering for every student. Together, they decided
              to build the solution they wished they had.
            </p>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
              One day, while discussing the future of education, a simple idea emerged:
            </p>
            <blockquote className="neu-inset rounded-2xl px-5 py-4 text-center text-lg sm:text-xl font-heading font-black text-foreground">
              &ldquo;What if every student could learn from their favorite teacher, anytime, anywhere — 24×7?&rdquo;
            </blockquote>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
              That single question became the foundation of <span className="font-bold text-primary">O3Origin</span>.
            </p>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
              <span className="font-bold text-primary">O3Origin</span> wasn&apos;t built just to solve questions. It was built so that
              <span className="font-bold text-foreground"> no student ever feels alone while studying</span>. By combining AI with great teaching,
              O3Origin provides personalized guidance, identifies every student&apos;s learning gaps, and makes high-quality education accessible
              to everyone — regardless of where they come from.
            </p>
            <p className="text-lg sm:text-xl font-heading font-black text-foreground text-center pt-2">
              Because we believe talent is everywhere.<br />
              <span className="text-primary">Opportunity should be too.</span>
            </p>
          </div>
        </motion.div>

        {/* Founder cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 w-full">
          {FOUNDERS.map((f, index) => (
            <motion.div
              key={f.name}
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08 * index, ease: [0.22, 1, 0.36, 1] }}
              className="shine-card relative flex flex-col items-center text-center rounded-3xl neu-raised p-6 sm:p-7 transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1"
            >
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full neu-inset p-1.5 mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.photo} alt={f.name} className="w-full h-full rounded-full object-cover" />
              </div>
              <h3 className="text-lg font-heading font-black tracking-tight text-foreground">{f.name}</h3>
              <p className="text-xs font-black uppercase tracking-widest text-primary mt-1">{f.role}</p>
              <p className="text-[11px] font-bold text-muted-foreground mt-1">{f.edu}</p>
              <div className="mt-4 pt-4 border-t border-black/[0.06] dark:border-white/[0.06] w-full space-y-2 text-left">
                {f.points.map((p, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px] sm:text-xs font-medium text-foreground/75">
                    <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary/70" />
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </main>
  );
}
