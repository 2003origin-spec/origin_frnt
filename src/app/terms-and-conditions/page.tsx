'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Scale, ArrowLeft, CheckCircle2, User, Mail, DollarSign, Edit, AlertCircle, Key, FileText, Globe, Gavel, RefreshCw, Info, ScrollText, Link2, ShieldCheck, Zap } from 'lucide-react';

const SECTIONS = [
  { id: 'statutory-notice', title: 'Statutory Notices', icon: ScrollText },
  { id: 'acceptance', title: '1. Acceptance of Terms', icon: Info },
  { id: 'who-may-use', title: '2. Who May Use', icon: User },
  { id: 'age-consent', title: '3. Age & Consent', icon: Key },
  { id: 'accounts', title: '4. User Accounts', icon: FileText },
  { id: 'payments', title: '5. Subscriptions & Payments', icon: DollarSign },
  { id: 'acceptable-use', title: '6. Acceptable Use', icon: Scale },
  { id: 'marketplace', title: '7. Teacher Marketplace', icon: Globe },
  { id: 'intellectual-property', title: '8. Intellectual Property', icon: Gavel },
  { id: 'third-party-links', title: '9. Third-Party Links', icon: Link2 },
  { id: 'disclaimers', title: '10. Disclaimers', icon: AlertCircle },
  { id: 'liability', title: '11. Limitation of Liability', icon: Scale },
  { id: 'indemnity', title: '12. Indemnity', icon: ShieldCheck },
  { id: 'force-majeure', title: '13. Force Majeure', icon: Zap },
  { id: 'governing-law', title: '14. Governing Law & Jurisdiction', icon: Gavel },
  { id: 'changes-to-terms', title: '15. Changes to Terms', icon: RefreshCw },
  { id: 'contact', title: '16. Grievance & Contact', icon: Mail },
];

export default function TermsAndConditionsPage() {
  const [activeSection, setActiveSection] = useState('statutory-notice');

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
            TERMS
          </span>
        </div>

        {/* Page Title */}
        <header className="mb-16 text-center max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight mb-6 bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 dark:from-white dark:via-gray-300 dark:to-white bg-clip-text text-transparent">
            Terms and Conditions
          </h1>
          <p className="text-lg text-muted-foreground font-medium leading-relaxed mb-4">
            Please read these terms carefully before using O3 Origin.
          </p>
          <div className="flex justify-center items-center gap-2 flex-wrap text-xs text-muted-foreground font-bold uppercase tracking-widest neu-inset rounded-full px-4 py-2 w-max mx-auto">
            <span>O3 ORIGIN · SUPERGOAT TECHNOLOGIES PRIVATE LIMITED</span>
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

              {/* Statutory Notices & Platform Owner */}
              <section id="statutory-notice" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <ScrollText className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">Statutory Notices &amp; Platform Owner</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    This document is an electronic record in terms of the Information Technology Act, 2000 and the rules
                    thereunder as applicable, and the amended provisions pertaining to electronic records in various
                    statutes as amended by the Information Technology Act, 2000. This electronic record is generated by a
                    computer system and does not require any physical or digital signatures.
                  </p>
                  <p>
                    This document is published in accordance with the provisions of Rule 3 (1) of the Information
                    Technology (Intermediaries Guidelines) Rules, 2011 that require publishing the rules and regulations,
                    privacy policy and Terms of Use for access or usage of the domain name{' '}
                    <a href="https://www.o3origin.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold">
                      www.o3origin.com
                    </a>{' '}
                    (&lsquo;Website&rsquo;), including the related mobile site and mobile application (hereinafter referred
                    to as &lsquo;Platform&rsquo;).
                  </p>
                  <p className="bg-primary/5 border border-primary/20 p-5 rounded-2xl text-sm font-semibold leading-relaxed">
                    The Platform is owned and operated by O3 Origin, a brand of{' '}
                    <strong>SUPERGOAT TECHNOLOGIES PRIVATE LIMITED</strong>, a company incorporated under the Companies
                    Act, 2013 (18 of 2013) with Corporate Identity Number (CIN) U85500TR2026PTC014780, having its
                    registered office at Ramnagar Road No. 1, Ramnagar, Sadar, West Tripura – 799002, Tripura, India
                    (hereinafter referred to as &lsquo;Platform Owner&rsquo;, &lsquo;we&rsquo;, &lsquo;us&rsquo;,
                    &lsquo;our&rsquo;).
                  </p>
                  <p>
                    Your use of the Platform and services and tools is governed by these Terms of Use including the
                    applicable policies which are incorporated herein by way of reference. By mere use of the Platform,
                    you shall be contracting with the Platform Owner and these Terms of Use including the policies
                    constitute your binding obligations with the Platform Owner. These Terms of Use can be modified at any
                    time without assigning any reason. It is your responsibility to periodically review these Terms of Use
                    to stay informed of updates. Accessing, browsing or otherwise using the Platform indicates your
                    agreement to all the terms and conditions under these Terms of Use, so please read the Terms of Use
                    carefully before proceeding.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 1. Acceptance of Terms */}
              <section id="acceptance" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Info className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">1. Acceptance of Terms</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    By registering for or using O3 Origin (the 'Platform'), you agree to be bound by these Terms and
                    Conditions.
                  </p>
                  <p>
                    If you are under 18, your parent or legal guardian must review and accept these Terms on
                    your behalf. If you do not agree with any part of these Terms, you must not use the Platform.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 2. Who May Use O3 Origin */}
              <section id="who-may-use" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <User className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">2. Who May Use O3 Origin</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>O3 Origin is open to:</p>
                  <ul className="space-y-3 list-none pl-0">
                    {[
                      "Students of any age who have parental consent if under 18",
                      "Teachers and educators who wish to join the teacher marketplace",
                      "Coaching centres and educational institutions entering into B2B agreements"
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-1" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4">
                    You must provide accurate and truthful information during registration. You are responsible for
                    maintaining the confidentiality of your account credentials.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 3. Age and Parental Consent */}
              <section id="age-consent" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Key className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">3. Age and Parental Consent</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    Users under 18 years of age must have explicit, verified parental or guardian consent before activating
                    an account on O3 Origin. The parent or guardian is responsible for supervising the minor's use of the
                    Platform.
                  </p>
                  <p>
                    O3 Origin accepts no liability for a minor's use of the Platform where parental consent
                    verification was bypassed through false information.
                  </p>
                  <p className="bg-primary/5 border border-primary/20 p-5 rounded-2xl text-sm font-semibold leading-relaxed">
                    No user under 18 may independently make any payment on O3 Origin. All financial transactions for
                    minor users must be authorised and completed by a parent or legal guardian.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 4. User Accounts */}
              <section id="accounts" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">4. User Accounts</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-3.5 font-medium">
                  <ul className="space-y-3 list-none pl-0">
                    {[
                      "You must not share your account with others or allow others to use your account",
                      "You are responsible for all activity occurring under your account",
                      "You must notify us immediately of any unauthorised access to your account",
                      "We reserve the right to suspend or terminate accounts that violate these Terms"
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-1" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 5. Subscriptions and Payments */}
              <section id="payments" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">5. Subscriptions and Payments</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <h3 className="text-lg font-bold text-foreground mb-2">Free Tier</h3>
                  <p>
                    O3 Origin offers a free tier with limited features available to all registered users. No payment is required
                    to access free tier features.
                  </p>

                  <h3 className="text-lg font-bold text-foreground mt-6 mb-2">Paid Subscriptions</h3>
                  <p>
                    Pro and Elite subscription plans are available at the pricing displayed on the Platform at the time of
                    purchase. Prices are in Indian Rupees and inclusive of applicable taxes. Subscription fees are charged
                    in advance on a monthly basis.
                  </p>

                  <h3 className="text-lg font-bold text-foreground mt-6 mb-2">Payment by Minors Prohibited</h3>
                  <p>
                    Users under 18 are strictly prohibited from independently purchasing any paid subscription or making
                    any payment on the Platform. All payments for minor users must be made by a parent or legal guardian
                    who has reviewed and accepted these Terms.
                  </p>
                  <p>
                    O3 Origin reserves the right to cancel a subscription and issue a refund if it is determined that
                    payment was made independently by a user under 18 without parental authorisation.
                  </p>

                  <h3 className="text-lg font-bold text-foreground mt-6 mb-2">Refund Policy</h3>
                  <p>
                    Subscription fees are non-refundable except in the following circumstances: technical failure preventing
                    access to the Platform for more than 72 consecutive hours, duplicate payment due to a platform error,
                    or payment made independently by a verified minor. Refund requests must be submitted to{' '}
                    <a href="mailto:adminoffice@o3origin.com" className="text-primary hover:underline font-bold">
                      adminoffice@o3origin.com
                    </a>{' '}
                    within 7 days of the transaction.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 6. Acceptable Use */}
              <section id="acceptable-use" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Scale className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">6. Acceptable Use</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>You agree not to:</p>
                  <ul className="space-y-3 list-none pl-0">
                    {[
                      "Use the Platform for any unlawful purpose or in violation of these Terms",
                      "Attempt to gain unauthorised access to any part of the Platform or its infrastructure",
                      "Submit false, misleading, or fraudulent information",
                      "Harass, bully, or threaten other users or teachers on the Platform",
                      "Copy, redistribute, or commercially exploit any content from the Platform without written permission",
                      "Use automated tools, bots, or scrapers to extract data from the Platform",
                      "Impersonate any person, teacher, or organisation on the Platform"
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-1" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 7. Teacher Marketplace */}
              <section id="marketplace" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Globe className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">7. Teacher Marketplace</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    Teachers who join the O3 Origin marketplace agree that their teaching style and content are used to
                    create AI agents solely for educational purposes on the Platform. Teacher AI agent creation requires
                    separate written consent and is governed by the Teacher Agreement provided at onboarding.
                  </p>
                  <p>
                    Teachers earn 60% of subscription revenue attributed to their AI agent, paid monthly subject to a minimum
                    threshold. O3 Origin reserves the right to remove a teacher's AI agent if the teacher withdraws consent,
                    violates platform policies, or if their content is found to be inaccurate or harmful.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 8. Intellectual Property */}
              <section id="intellectual-property" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Gavel className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">8. Intellectual Property</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    All content on O3 Origin including the platform design, AI models, algorithms, question banks, and
                    original educational content is the intellectual property of{' '}
                    <strong>SUPERGOAT TECHNOLOGIES PRIVATE LIMITED</strong>. You may not copy, reproduce, or distribute
                    any platform content without written permission.
                  </p>
                  <p>
                    Content you submit to the Platform, including test responses and conversation data, remains your property
                    but you grant O3 Origin a licence to use it for providing and improving the service.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 9. Third-Party Links */}
              <section id="third-party-links" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Link2 className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">9. Third-Party Links</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    You agree and acknowledge that the Website and the Services may contain links to other third-party
                    websites. On accessing these links, you will be governed by the terms of use, privacy policy and such
                    other policies of such third-party websites. These links are provided for your convenience to provide
                    further information.
                  </p>
                  <p>
                    Neither we nor any third parties provide any warranty or guarantee as to the accuracy, timeliness,
                    performance, completeness or suitability of the information and materials found or offered on the
                    Platform or through the Services for any particular purpose. You acknowledge that such information and
                    materials may contain inaccuracies or errors and we expressly exclude liability for any such
                    inaccuracies or errors to the fullest extent permitted by law. Your use of the Platform and the
                    Services is solely at your own risk.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 10. Disclaimers */}
              <section id="disclaimers" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">10. Disclaimers</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    O3 Origin is an educational tool designed to supplement and support exam preparation. We do not
                    guarantee specific examination results or rank improvements. Academic outcomes depend on many
                    factors beyond the Platform's control.
                  </p>
                  <p>
                    The Platform is provided on an 'as is' basis. While we strive for accuracy in our AI-generated content,
                    we recommend students verify critical information with qualified educators.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 11. Limitation of Liability */}
              <section id="liability" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Scale className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">11. Limitation of Liability</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    To the maximum extent permitted by applicable Indian law,{' '}
                    <strong>SUPERGOAT TECHNOLOGIES PRIVATE LIMITED</strong> shall not be liable for any indirect,
                    incidental, or consequential damages arising from use of or inability to use the Platform.
                  </p>
                  <p>
                    Our total liability for any claim arising from use of the Platform shall not exceed the
                    subscription fees paid by you in the 3 months preceding the claim.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 12. Indemnity */}
              <section id="indemnity" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">12. Indemnity</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    You shall indemnify and hold harmless the Platform Owner, its affiliates, group companies (as
                    applicable) and their respective officers, directors, agents, and employees, from any claim or
                    demand, or actions including reasonable attorney&rsquo;s fees, made by any third party or penalty
                    imposed due to or arising out of your breach of these Terms of Use, Privacy Policy and other
                    policies, or your violation of any law, rules or regulations or the rights (including infringement of
                    intellectual property rights) of a third party.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 13. Force Majeure */}
              <section id="force-majeure" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Zap className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">13. Force Majeure</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    Notwithstanding anything contained in these Terms of Use, the parties shall not be liable for any
                    failure to perform an obligation under these Terms if performance is prevented or delayed by a force
                    majeure event.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 14. Governing Law & Jurisdiction */}
              <section id="governing-law" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Gavel className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">14. Governing Law &amp; Jurisdiction</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    These Terms and any dispute or claim relating to them, or their enforceability, shall be governed by
                    and construed in accordance with the laws of India. All disputes arising out of or in connection with
                    these Terms shall be subject to the exclusive jurisdiction of the courts in Agartala, Tripura, India.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 15. Changes to Terms */}
              <section id="changes-to-terms" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">15. Changes to Terms</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    We reserve the right to modify these Terms at any time. Material changes will be communicated to
                    registered users via email and in-app notification at least 7 days before taking effect. Continued use of
                    the Platform after the effective date of revised Terms constitutes acceptance.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 16. Grievance & Contact */}
              <section id="contact" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Mail className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">16. Grievance &amp; Contact</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    All concerns or communications relating to these Terms must be communicated to us using the contact
                    information provided below:
                  </p>
                  <div className="neu-inset rounded-2xl p-6 space-y-2 text-sm font-semibold">
                    <p className="text-foreground font-bold">Brand: O3 Origin</p>
                    <p className="text-foreground font-bold">Legal Entity: SUPERGOAT TECHNOLOGIES PRIVATE LIMITED</p>
                    <p className="flex items-center gap-2">
                      <span className="text-muted-foreground">CIN:</span>{' '}
                      <span className="text-foreground">U85500TR2026PTC014780</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="text-muted-foreground">Email:</span>{' '}
                      <a href="mailto:adminoffice@o3origin.com" className="text-primary hover:underline">
                        adminoffice@o3origin.com
                      </a>
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="text-muted-foreground">Website:</span>{' '}
                      <a href="https://o3origin.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        o3origin.com
                      </a>
                    </p>
                    <p className="text-muted-foreground font-medium">Ramnagar Road No. 1, Ramnagar, Sadar, West Tripura – 799002, Tripura, India</p>
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
