'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Truck, Clock, MapPin, BadgeInfo, Mail } from 'lucide-react';

const SECTIONS = [
  { id: 'dispatch', title: '1. Dispatch & Carriers', icon: Truck },
  { id: 'timelines', title: '2. Delivery Timelines', icon: Clock },
  { id: 'address', title: '3. Delivery & Confirmation', icon: MapPin },
  { id: 'charges', title: '4. Shipping Charges', icon: BadgeInfo },
  { id: 'contact', title: '5. Contact', icon: Mail },
];

export default function ShippingPolicyPage() {
  const [activeSection, setActiveSection] = useState('dispatch');

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
            SHIPPING
          </span>
        </div>

        {/* Page Title */}
        <header className="mb-16 text-center max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight mb-6 bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 dark:from-white dark:via-gray-300 dark:to-white bg-clip-text text-transparent">
            Shipping Policy
          </h1>
          <p className="text-lg text-muted-foreground font-medium leading-relaxed mb-4">
            How orders are shipped, delivered, and confirmed for purchases made through O3 Origin.
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

              {/* 1. Dispatch & Carriers */}
              <section id="dispatch" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Truck className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">1. Dispatch &amp; Carriers</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    The orders for the user are shipped through registered domestic courier companies and/or speed post
                    only.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 2. Delivery Timelines */}
              <section id="timelines" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Clock className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">2. Delivery Timelines</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    Orders are shipped within <strong>24 hours</strong> from the date of the order and/or payment or as
                    per the delivery date agreed at the time of order confirmation and delivering of the shipment,
                    subject to courier company / post office norms.
                  </p>
                  <p>
                    O3 Origin (a brand operated by SUPERGOAT TECHNOLOGIES PRIVATE LIMITED, the &lsquo;Platform
                    Owner&rsquo;) shall not be liable for any delay in delivery by the courier company / postal
                    authority.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 3. Delivery & Confirmation */}
              <section id="address" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">3. Delivery &amp; Confirmation</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    Delivery of all orders will be made to the address provided by the buyer at the time of purchase.
                    Delivery of our services will be confirmed on your email ID as specified at the time of registration.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 4. Shipping Charges */}
              <section id="charges" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <BadgeInfo className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">4. Shipping Charges</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    If there are any shipping cost(s) levied by the seller or the Platform Owner (as the case may be),
                    the same is not refundable.
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
                  <p>For any shipping or delivery queries, please reach out to our customer service team:</p>
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
