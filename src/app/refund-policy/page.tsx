'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, XCircle, CheckCircle2, Ban, FileText, Wallet, Mail } from 'lucide-react';

const SECTIONS = [
  { id: 'cancellations', title: '1. Cancellations', icon: XCircle },
  { id: 'eligibility', title: '2. Refund Eligibility', icon: CheckCircle2 },
  { id: 'non-refundable', title: '3. Non-Refundable Cases', icon: Ban },
  { id: 'how-to-request', title: '4. How to Request', icon: FileText },
  { id: 'refund-processing', title: '5. Refund Processing', icon: Wallet },
  { id: 'contact', title: '6. Contact', icon: Mail },
];

export default function RefundPolicyPage() {
  const [activeSection, setActiveSection] = useState('cancellations');

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
            REFUNDS
          </span>
        </div>

        {/* Page Title */}
        <header className="mb-16 text-center max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight mb-6 bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 dark:from-white dark:via-gray-300 dark:to-white bg-clip-text text-transparent">
            Cancellation & Refund Policy
          </h1>
          <p className="text-lg text-muted-foreground font-medium leading-relaxed mb-4">
            How you can cancel a subscription or seek a refund for a purchase made through O3 Origin.
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

              <div className="text-muted-foreground leading-relaxed font-medium space-y-4">
                <p>
                  This Cancellation &amp; Refund Policy explains how you can cancel a subscription or request a refund
                  for a purchase made through O3 Origin (the &lsquo;Platform&rsquo;). O3 Origin provides digital
                  education services only — there are no physical goods, shipping, or delivery involved.
                </p>
                <p>
                  This policy should be read together with our{' '}
                  <Link href="/terms-and-conditions" className="text-primary hover:underline font-bold">
                    Terms &amp; Conditions
                  </Link>
                  . Where this policy and the Terms differ, the Terms &amp; Conditions prevail.
                </p>
              </div>

              {/* 1. Cancellations */}
              <section id="cancellations" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <XCircle className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">1. Cancellations</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    Paid plans on O3 Origin are billed monthly in advance as recurring subscriptions. You may cancel a
                    subscription at any time from your account settings or by contacting our support team. There is no
                    cancellation fee.
                  </p>
                  <p>
                    Cancelling stops all future renewals. You will continue to have access to the paid features until the
                    end of the billing cycle you have already paid for. Cancelling does not by itself refund the current
                    billing period — refund eligibility is covered in the next section.
                  </p>
                  <p>
                    The free tier requires no payment and can be stopped at any time with nothing to cancel or refund.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 2. Refund Eligibility */}
              <section id="eligibility" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">2. Refund Eligibility</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    Subscription fees are non-refundable except in the following circumstances:
                  </p>
                  <ul className="space-y-3 list-none pl-0">
                    {[
                      'A technical failure that prevented access to the Platform for more than 72 consecutive hours.',
                      'A duplicate payment charged due to a platform or payment-gateway error.',
                      'A payment made independently by a verified minor (under 18) without parental or guardian authorisation.',
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-1" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="bg-primary/5 border border-primary/20 p-5 rounded-2xl text-sm font-semibold leading-relaxed">
                    Refund requests must be submitted within 7 days of the transaction. Requests made after this window
                    will not be eligible.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 3. Non-Refundable Cases */}
              <section id="non-refundable" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Ban className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">3. Non-Refundable Cases</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>The following are not eligible for a refund:</p>
                  <ul className="space-y-3 list-none pl-0">
                    {[
                      'Change of mind after you have accessed paid content or features.',
                      'Unused time remaining after a mid-cycle cancellation — access continues until the end of the paid period instead of being refunded.',
                      'Free-tier usage, since no payment is taken.',
                      'Requests raised after the 7-day eligibility window has lapsed.',
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <Ban className="w-4 h-4 text-primary shrink-0 mt-1" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 4. How to Request a Refund */}
              <section id="how-to-request" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">4. How to Request a Refund</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    To request a refund, email us at{' '}
                    <a href="mailto:2003origin@gmail.com" className="text-primary hover:underline font-bold">
                      2003origin@gmail.com
                    </a>{' '}
                    within 7 days of the transaction, using the email address registered on your account. Please include
                    the payment date, the amount, the plan purchased, and a short description of the issue so our team
                    can locate the transaction and review it.
                  </p>
                  <p>
                    Our customer service team will review the request against the eligibility criteria above and take an
                    appropriate decision, which will be communicated to you by email.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 5. Refund Processing */}
              <section id="refund-processing" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">5. Refund Processing</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    Once a refund is approved by O3 Origin, it will be processed to your original payment method within{' '}
                    <strong>7 days</strong>. The time taken for the amount to reflect in your account thereafter depends
                    on your bank or payment provider.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 6. Contact */}
              <section id="contact" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Mail className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">6. Contact</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>For any cancellation or refund queries, please reach out to our customer service team:</p>
                  <div className="neu-inset rounded-2xl p-6 space-y-2 text-sm font-semibold">
                    <p className="text-foreground font-bold">SUPERGOAT TECHNOLOGIES PRIVATE LIMITED</p>
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
                    <p className="text-muted-foreground font-medium">Agartala, Tripura, India</p>
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
