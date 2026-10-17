import { useEffect, useState } from 'react';

const DEFAULT_TICK_MS = 30_000;

/** The current time, re-read every `tickMs` so countdowns and "has it started yet" stay fresh. */
export function useNow(tickMs = DEFAULT_TICK_MS): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(timer);
  }, [tickMs]);
  return now;
}
