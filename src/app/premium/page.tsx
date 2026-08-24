import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { isSubscriptionsRailEnabled } from '@/server/payments/razorpay-client';
import PremiumClient from './_client';

export const metadata: Metadata = {
  title: 'Pricing & Premium Plans — ORIGIN AI for JEE & NEET',
  description:
    'Origin premium plans for JEE & NEET — per-subject AI mentoring, infinite practice, detailed diagnostics and test analytics. See pricing.',
  alternates: { canonical: '/premium' },
  openGraph: {
    title: 'Pricing & Premium Plans — ORIGIN AI',
    description: 'Per-subject AI mentoring, infinite practice and diagnostics for JEE & NEET.',
    url: '/premium',
    type: 'website',
  },
};

export default function PremiumPage() {
  // Premium surface ships dark behind `premiumSubscriptions`. While it is off
  // (the default), the page is not reachable — bounce to the dashboard so no
  // subscription/upgrade screen renders. Re-enabling is purely a flag flip.
  if (!isFeatureEnabled('premiumSubscriptions')) {
    redirect('/dashboard');
  }
  return (
    <PremiumClient
      paymentsEnabled={isFeatureEnabled('payments')}
      couponsEnabled={isFeatureEnabled('adminCoupons')}
      // Rail B (auto-renewing mandate) is dark until Razorpay approves
      // e-mandate on the account — plan D1/Q2, Phase 6.
      subscriptionsEnabled={isSubscriptionsRailEnabled()}
    />
  );
}
