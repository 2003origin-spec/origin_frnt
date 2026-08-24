'use client';

import Premium from '@/sections/Premium';

export default function PremiumClient({
  paymentsEnabled = false,
  couponsEnabled = false,
  subscriptionsEnabled = false,
}: { paymentsEnabled?: boolean; couponsEnabled?: boolean; subscriptionsEnabled?: boolean }) {
  return (
    <Premium
      paymentsEnabled={paymentsEnabled}
      couponsEnabled={couponsEnabled}
      subscriptionsEnabled={subscriptionsEnabled}
    />
  );
}
