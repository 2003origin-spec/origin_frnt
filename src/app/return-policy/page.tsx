'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, RotateCcw, CheckCircle2, Ban, ClipboardCheck, Mail } from 'lucide-react';

const SECTIONS = [
  { id: 'window', title: '1. Return & Exchange Window', icon: RotateCcw },
  { id: 'eligibility', title: '2. Eligibility', icon: CheckCircle2 },
  { id: 'exempted', title: '3. Exempted Categories', icon: Ban },
  { id: 'process', title: '4. Inspection & Approval', icon: ClipboardCheck },
  { id: 'contact', title: '5. Contact', icon: Mail },
];

export default function ReturnPolicyPage() {
  const [activeSection, setActiveSection] = useState('window');

  useEffect(() => {
    const container = document.querySelector('main');
    const observerOptions = {
      root: container,
      rootMargin: '-100px 0px -60% 0px',
      threshold: 0,
    };

    const visibleSections = new Map<string, boolean>();

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        visibleSections.set(entry.target.id, entry.isIntersecting);
      });

      const intersectingIds = SECTIONS.map((s) => s.id).filter((id) => visibleSections.get(id));

      if (intersectingIds.length > 0) {
        setActiveSection(intersectingIds[0]);
      }
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    SECTIONS.forEach((section) => {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const activeLink = document.getElementById(`sidebar-link-${activeSection}`);
    if (activeLink) {
      activeLink.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [activeSection]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      setActiveSection(id);
    }
  };

  return (
    <div className="min-h-screen neu-surface text-foreground font-sans relative overflow-x-hidden">
      {/* Background Glows */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-30 dark:opacity-20">
        <div className="absolute top-[-10%] left-[-20%] w-[60%] h-[60%] bg-primary/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[-20%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Navigation & Back Button */}
        <div className="mb-10 flex items-center justify-between">
          <Link
            href="/"
            className="group flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary transition-all duration-300"
            id="back-home-btn"
          >
            <div className="p-2 neu-raised rounded-full group-hover:scale-105 transition-transform">
              <ArrowLeft className="w-4 h-4" />
            </div>
            Back to Home
          </Link>
          <span className="neu-raised rounded-full px-3 py-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            RETURNS
          </span>
        </div>

        {/* Page Title */}
        <header className="mb-16 text-center max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight mb-6 bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 dark:from-white dark:via-gray-300 dark:to-white bg-clip-text text-transparent">
            Return Policy
          </h1>
          <p className="text-lg text-muted-foreground font-medium leading-relaxed mb-4">
            Our terms for returns, exchanges, and replacements on purchases made through O3 Origin.
          </p>
          <div className="flex justify-center items-center gap-2 flex-wrap text-xs text-muted-foreground font-bold uppercase tracking-widest neu-inset rounded-full px-4 py-2 w-max mx-auto">
            <span>SUPERGOAT TECHNOLOGIES PRIVATE LIMITED</span>
            <span className="text-border">•</span>
            <span>o3origin.com</span>
            <span className="text-border">•</span>
            <span>Effective Date: June 1, 2026</span>
          </div>
        </header>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left: Sticky Sidebar Index */}
          <aside className="lg:col-span-4 sticky top-28 hidden lg:block">
            <div className="neu-raised rounded-3xl p-6 relative overflow-hidden">
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-6">
                Document Contents
              </h2>
              <nav className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
                {SECTIONS.map((section) => {
                  const Icon = section.icon;
                  const isActive = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => scrollToSection(section.id)}
                      className={`flex items-center gap-3 px-4 py-3 text-xs font-black uppercase tracking-wider rounded-xl text-left transition-all duration-300 ${
                        isActive
                          ? 'neu-raised text-primary'
                          : 'rounded-xl hover:neu-raised transition-all text-muted-foreground hover:text-foreground'
                      }`}
                      id={`sidebar-link-${section.id}`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{section.title}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Right: Policy Content */}
          <article className="lg:col-span-8 space-y-12">
            <div className="neu-raised rounded-3xl p-8 sm:p-12 space-y-12">

              {/* 1. Return & Exchange Window */}
              <section id="window" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">1. Return &amp; Exchange Window</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    We offer refund / exchange within the first <strong>3 days</strong> from the date of your purchase.
                    If 3 days have passed since your purchase, you will not be offered a return, exchange or refund of
                    any kind.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 2. Eligibility */}
              <section id="eligibility" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">2. Eligibility</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>In order to become eligible for a return or an exchange:</p>
                  <ul className="space-y-3 list-none pl-0">
                    {[
                      'The purchased item should be unused and in the same condition as you received it.',
                      'The item must have its original packaging.',
                      'If the item was purchased on a sale, then the item may not be eligible for a return / exchange.',
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-1" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <p>
                    Further, only such items are replaced by us (based on an exchange request), if such items are found
                    defective or damaged.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 3. Exempted Categories */}
              <section id="exempted" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Ban className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">3. Exempted Categories</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    You agree that there may be a certain category of products / items that are exempted from returns or
                    refunds. Such categories of the products would be identified to you at the time of purchase.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 4. Inspection & Approval */}
              <section id="process" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <ClipboardCheck className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">4. Inspection &amp; Approval</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    For exchange / return accepted request(s) (as applicable), once your returned product / item is
                    received and inspected by us, we will send you an email to notify you about the receipt of the
                    returned / exchanged product. Further, if the same has been approved after the quality check at our
                    end, your request (i.e. return / exchange) will be processed in accordance with our policies.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 5. Contact */}
              <section id="contact" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Mail className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">5. Contact</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>For any return or exchange queries, please reach out to our customer service team:</p>
                  <div className="neu-inset rounded-2xl p-6 space-y-2 text-sm font-semibold">
                    <p className="text-foreground font-bold">O3 Origin — a brand of SUPERGOAT TECHNOLOGIES PRIVATE LIMITED</p>
                    <p className="flex items-center gap-2">
                      <span className="text-muted-foreground">Email:</span>{' '}
                      <a href="mailto:2003origin@gmail.com" className="text-primary hover:underline">
                        2003origin@gmail.com
                      </a>
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="text-muted-foreground">Website:</span>{' '}
                      <a href="https://o3origin.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        o3origin.com
                      </a>
                    </p>
                    <p className="text-muted-foreground font-medium">Ramnagar road no 1, Agartala, Tripura, India</p>
                  </div>
                </div>
              </section>

            </div>
          </article>
        </div>

        {/* Footer info */}
        <footer className="mt-20 text-center text-xs text-muted-foreground border-t border-border/40 pt-8">
          <p>© 2026 SUPERGOAT TECHNOLOGIES PRIVATE LIMITED. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
