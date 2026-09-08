'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, XCircle, PackageX, AlertTriangle, RefreshCw, ShieldCheck, Wallet, Mail } from 'lucide-react';

const SECTIONS = [
  { id: 'cancellations', title: '1. Cancellations', icon: XCircle },
  { id: 'perishable', title: '2. Perishable Items', icon: PackageX },
  { id: 'damaged', title: '3. Damaged or Defective', icon: AlertTriangle },
  { id: 'not-as-described', title: '4. Not as Described', icon: RefreshCw },
  { id: 'warranty', title: '5. Manufacturer Warranty', icon: ShieldCheck },
  { id: 'refund-processing', title: '6. Refund Processing', icon: Wallet },
  { id: 'contact', title: '7. Contact', icon: Mail },
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
    <div className="min-h-dvh neu-surface text-foreground font-sans relative overflow-x-hidden">
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
            Refund &amp; Cancellation Policy
          </h1>
          <p className="text-lg text-muted-foreground font-medium leading-relaxed mb-4">
            How you can cancel an order or seek a refund for a product / service purchased through O3 Origin.
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

              <div className="text-muted-foreground leading-relaxed font-medium">
                <p>
                  This refund and cancellation policy outlines how you can cancel or seek a refund for a product /
                  service that you have purchased through the Platform. Under this policy:
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
                    Cancellations will only be considered if the request is made within <strong>7 days</strong> of
                    placing the order. However, cancellation requests may not be entertained if the orders have been
                    communicated to such sellers / merchant(s) listed on the Platform and they have initiated the
                    process of shipping them, or the product is out for delivery. In such an event, you may choose to
                    reject the product at the doorstep.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 2. Perishable Items */}
              <section id="perishable" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <PackageX className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">2. Perishable Items</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    O3 Origin does not accept cancellation requests for perishable items like flowers, eatables, etc.
                    However, the refund / replacement can be made if the user establishes that the quality of the
                    product delivered is not good.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 3. Damaged or Defective Items */}
              <section id="damaged" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">3. Damaged or Defective Items</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    In case of receipt of damaged or defective items, please report to our customer service team. The
                    request would be entertained once the seller / merchant listed on the Platform has checked and
                    determined the same at its own end. This should be reported within <strong>7 days</strong> of
                    receipt of the products.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 4. Not as Described */}
              <section id="not-as-described" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">4. Product Not as Described</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    In case you feel that the product received is not as shown on the site or as per your expectations,
                    you must bring it to the notice of our customer service within <strong>7 days</strong> of receiving
                    the product. The customer service team, after looking into your complaint, will take an appropriate
                    decision.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 5. Manufacturer Warranty */}
              <section id="warranty" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">5. Manufacturer Warranty</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    In case of complaints regarding the products that come with a warranty from the manufacturers,
                    please refer the issue to them.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 6. Refund Processing */}
              <section id="refund-processing" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">6. Refund Processing</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    In case of any refunds approved by O3 Origin, it will take <strong>3 days</strong> for the refund to
                    be processed to you.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 7. Contact */}
              <section id="contact" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Mail className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">7. Contact</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>For any cancellation or refund queries, please reach out to our customer service team:</p>
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
