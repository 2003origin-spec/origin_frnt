import { useEffect, useMemo, useState } from "react";

import { computeRemainingSeconds, type ServerAnchoredTimerSource } from "@/lib/server-clock";

export type { ServerAnchoredTimerSource };

const remainingNow = (source: ServerAnchoredTimerSource) => computeRemainingSeconds(source, Date.now());

export function useServerAnchoredTimer(source: ServerAnchoredTimerSource | undefined, active: boolean) {
  const initial = useMemo(() => (source ? remainingNow(source) : 0), [source]);
  const [remainingSeconds, setRemainingSeconds] = useState(initial);

  useEffect(() => {
    if (!source || !active) return;
    const interval = window.setInterval(() => {
      setRemainingSeconds(remainingNow(source));
    }, 250);
    return () => window.clearInterval(interval);
  }, [active, source]);

  return remainingSeconds;
}
